// GET /api/items: latest 20 rows. POST /api/items: insert one row { title, data? }.
import { getSupabase } from "@/lib/supabase";
import { CreateItemRequestSchema } from "@/lib/schema";

export async function GET() {
  const supabase = getSupabase();
  if (!supabase.ok) {
    return Response.json({ error: supabase.error }, { status: 500 });
  }

  const { data, error } = await supabase.client
    .from("items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return Response.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
  }

  return Response.json({ items: data });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = CreateItemRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid input: ${parsed.error.issues[0]?.message ?? "unknown validation error"}` },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  if (!supabase.ok) {
    return Response.json({ error: supabase.error }, { status: 500 });
  }

  const { data, error } = await supabase.client
    .from("items")
    .insert({ title: parsed.data.title, data: parsed.data.data ?? null })
    .select()
    .single();

  if (error) {
    return Response.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
  }

  return Response.json({ item: data }, { status: 201 });
}
