import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { crashMonuments } from "../../db/schema.js";

const MAX_MONUMENTS = 300;
const ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1000000;
}

export default async function handler(request: Request) {
  if (request.method === "GET") {
    const gardenId = new URL(request.url).searchParams.get("gardenId") || "";
    if (!ID_PATTERN.test(gardenId)) {
      return Response.json({ error: "Invalid garden ID." }, { status: 400 });
    }

    const monuments = await db
      .select()
      .from(crashMonuments)
      .where(eq(crashMonuments.gardenId, gardenId))
      .orderBy(asc(crashMonuments.createdAt))
      .limit(MAX_MONUMENTS);

    return Response.json({ monuments });
  }

  if (request.method === "POST") {
    const payload = await request.json().catch(() => null);
    const gardenId = payload?.gardenId || "";
    const requestedMonuments = Array.isArray(payload?.monuments) ? payload.monuments : [payload];
    if (!ID_PATTERN.test(gardenId) || requestedMonuments.length < 1 || requestedMonuments.length > MAX_MONUMENTS) {
      return Response.json({ error: "Invalid crash monument." }, { status: 400 });
    }

    const uniqueMonuments = Array.from(
      new Map(requestedMonuments.map((monument) => [monument?.id, monument])).values(),
    );
    if (
      uniqueMonuments.some(
        (monument) =>
          !ID_PATTERN.test(monument?.id || "") ||
          !isFiniteCoordinate(monument?.x) ||
          !isFiniteCoordinate(monument?.z),
      )
    ) {
      return Response.json({ error: "Invalid crash monument." }, { status: 400 });
    }

    const existing = await db
      .select({ id: crashMonuments.id })
      .from(crashMonuments)
      .where(eq(crashMonuments.gardenId, gardenId))
      .limit(MAX_MONUMENTS);

    const existingIds = new Set(existing.map((monument) => monument.id));
    const newMonuments = uniqueMonuments.filter((monument) => !existingIds.has(monument.id));
    if (existing.length + newMonuments.length > MAX_MONUMENTS) {
      return Response.json({ error: "Garden limit reached." }, { status: 409 });
    }

    if (!newMonuments.length) {
      return Response.json({ monuments: [] });
    }

    const monuments = await db
      .insert(crashMonuments)
      .values(newMonuments.map((monument) => ({
        id: monument.id,
        gardenId,
        x: monument.x,
        z: monument.z,
      })))
      .onConflictDoNothing({ target: crashMonuments.id })
      .returning();

    return Response.json({ monuments }, { status: 201 });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { Allow: "GET, POST" },
  });
}

export const config = {
  path: "/api/crash-garden",
};
