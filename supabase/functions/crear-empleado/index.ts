// ============================================================
// crear-empleado
//
// Crea la cuenta de un ingresante con la clave secreta, sin
// tocar la sesión del usuario de RRHH que hace la llamada.
//
// Sin wrappers: clientes explícitos y validación a mano, para
// no depender de la versión del runtime.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SB = Deno.env.get("SUPABASE_URL");

// Los proyectos nuevos usan SECRET/PUBLISHABLE; los viejos, las legacy.
const CLAVE_SECRETA = Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CLAVE_PUBLICA = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY");

// Diagnóstico al arrancar: aparece en la pestaña Logs
console.log("── crear-empleado arrancó ──");
console.log("SUPABASE_URL presente:", !!URL_SB);
console.log("SECRET_KEY presente:", !!Deno.env.get("SUPABASE_SECRET_KEY"));
console.log("SERVICE_ROLE_KEY presente:", !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
console.log("PUBLISHABLE_KEY presente:", !!Deno.env.get("SUPABASE_PUBLISHABLE_KEY"));
console.log("ANON_KEY presente:", !!Deno.env.get("SUPABASE_ANON_KEY"));

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // ── 0. ¿Están las variables de entorno? ───────────
    if (!URL_SB || !CLAVE_SECRETA || !CLAVE_PUBLICA) {
      return json({
        error: "Faltan variables de entorno en la función",
        detalle: {
          SUPABASE_URL: !!URL_SB,
          clave_secreta: !!CLAVE_SECRETA,
          clave_publica: !!CLAVE_PUBLICA,
        },
      }, 500);
    }

    // ── 1. Leer el token de la sesión ─────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    console.log("token recibido:", token ? `sí (${token.length} chars)` : "no");

    if (!token) {
      return json({ error: "No llegó el token de sesión" }, 401);
    }

    // ── 2. Identificar al que llama ───────────────────
    const admin = createClient(URL_SB, CLAVE_SECRETA, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("getUser falló:", userError?.message);
      return json({
        error: "La sesión no es válida o expiró. Cerrá sesión y volvé a entrar.",
        detalle: userError?.message ?? null,
      }, 401);
    }

    const quienLlama = userData.user.id;
    console.log("llama:", userData.user.email, quienLlama);

    // ── 3. ¿Es de RRHH? ──────────────────────────────
    const { data: perfil, error: perfilError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", quienLlama)
      .single();

    if (perfilError) {
      console.error("perfil:", perfilError.message);
      return json({
        error: `No se pudo leer el perfil: ${perfilError.message}`,
      }, 403);
    }

    console.log("rol:", perfil?.role);

    if (perfil?.role !== "admin") {
      return json({
        error: "Solo Recursos Humanos puede crear empleados",
      }, 403);
    }

    // ── 4. Validar el payload ────────────────────────
    const body = await req.json();
    const { full_name, email, password } = body;

    if (!full_name?.trim() || !email?.trim() || !password) {
      return json({
        error: "Nombre, correo y contraseña son obligatorios",
      }, 400);
    }

    if (password.length < 6) {
      return json({
        error: "La contraseña debe tener al menos 6 caracteres",
      }, 400);
    }

    // ── 5. Crear la cuenta ───────────────────────────
    const { data: creado, error: createError } = await admin.auth.admin
      .createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true, // entra directo, sin verificar mail
        user_metadata: { full_name: full_name.trim(), role: "employee" },
      });

    if (createError) {
      // deno-lint-ignore no-explicit-any
      const e = createError as any;
      const detalle = {
        name: e.name ?? null,
        status: e.status ?? null,
        code: e.code ?? null,
        message: e.message ?? null,
        completo: JSON.stringify(createError),
      };
      console.error("createUser falló:", JSON.stringify(detalle));

      const texto = String(e.message ?? "");
      const yaExiste = texto.toLowerCase().includes("already") ||
        e.code === "email_exists";

      // 500 casi siempre significa que el trigger de profiles falló
      const esErrorDeBase = e.status === 500 ||
        texto.toLowerCase().includes("database error");

      return json({
        error: yaExiste
          ? "Ya existe una cuenta con ese correo"
          : esErrorDeBase
          ? "La base rechazó la creación. Suele ser el trigger de profiles: revisá que handle_new_user() no falle."
          : `Auth rechazó la creación (status ${e.status ?? "?"}): ${texto || "sin mensaje"}`,
        detalle,
      }, 400);
    }

    const nuevoId = creado.user.id;
    console.log("creado:", nuevoId);

    // ── 6. Completar el perfil ───────────────────────
    // El trigger on_auth_user_created ya insertó la fila base.
    const { error: updateError } = await admin
      .from("profiles")
      .upsert({
        id: nuevoId,
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        role: "employee",
        department: body.department?.trim() || null,
        position: body.position?.trim() || null,
        start_date: body.start_date || null,
        dni: body.dni?.trim() || null,
        phone: body.phone?.trim() || null,
      }, { onConflict: "id" });

    if (updateError) {
      console.error("update perfil:", updateError.message);
      return json({
        id: nuevoId,
        warning:
          `Cuenta creada, pero faltó guardar área y puesto: ${updateError.message}`,
      }, 200);
    }

    return json({ id: nuevoId, email: creado.user.email }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("excepción:", msg);
    return json({ error: msg }, 500);
  }
});