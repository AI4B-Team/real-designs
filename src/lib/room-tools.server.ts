/** Prompt building and model call for the one-credit Studio room tools. */

export type RoomTool = "stage" | "declutter" | "materials" | "sketch" | "angle";

export type RoomToolInput = {
  tool: RoomTool;
  image: string;
  room_type: string;
  direction: string;
  grade: string;
  notes?: string | null;
};

const BASE =
  "Hard rules: keep the exact same camera angle, focal length, perspective, room proportions, window and door positions, ceiling height and natural light direction unless the instruction below explicitly says otherwise. Do not move or resize architecture. Do not add rooms, windows or walls. Photorealistic result, no text, no watermarks, no labels, no people.";

export const TOOL_LABEL: Record<RoomTool, string> = {
  stage: "Virtual Stage",
  declutter: "Declutter",
  materials: "Material Swap",
  sketch: "Sketch To Render",
  angle: "Multi Angle",
};

export const TOOL_STEPS: Record<RoomTool, string[]> = {
  stage: ["Reading the empty room", "Choosing furniture that fits", "Placing and lighting the set", "Rendering the staged room"],
  declutter: ["Reading the room", "Marking clutter and personal items", "Filling the space naturally", "Rendering the clean room"],
  materials: ["Reading surfaces and finishes", "Selecting the new materials", "Matching light and reflection", "Rendering the swap"],
  sketch: ["Reading the sketch lines", "Building the geometry", "Applying real materials", "Rendering the photo"],
  angle: ["Reading room geometry", "Moving the virtual camera", "Keeping the design consistent", "Rendering the new angle"],
};

export function buildToolPrompt(d: RoomToolInput): string {
  const lines: string[] = [];
  switch (d.tool) {
    case "stage":
      lines.push(
        `Virtually stage this empty ${d.room_type} photograph in a ${d.direction} direction with ${d.grade} furniture and decor. Add realistic furniture, rugs, lighting and art scaled correctly to the room. Keep every existing surface, floor and wall finish exactly as photographed.`,
      );
      break;
    case "declutter":
      lines.push(
        `Declutter this ${d.room_type} photograph. Remove clutter, personal photos, cables, small appliances, laundry, boxes and rubbish, and fill the vacated space naturally with the surfaces already visible. Keep all furniture, finishes and fixtures exactly as they are. Do not restyle the room.`,
      );
      break;
    case "materials":
      lines.push(
        `Swap the surface materials in this ${d.room_type} photograph to a ${d.direction} direction with ${d.grade} finishes: flooring, wall paint, countertops, tile and cabinetry fronts. Keep the furniture layout, fixture positions and every object in place. Only the materials change.`,
      );
      break;
    case "sketch":
      lines.push(
        `Turn this hand drawn sketch or line drawing of a ${d.room_type} into a photorealistic interior photograph in a ${d.direction} direction with ${d.grade} finishes. Follow the sketch layout, proportions and openings exactly. Use realistic materials, natural light and a believable camera.`,
      );
      break;
    case "angle":
      lines.push(
        `Render this same ${d.room_type} from a different camera position: step back and rotate roughly 35 degrees to reveal more of the space. Keep the identical room, identical design, identical furniture, materials, lighting and time of day. This is a second photograph of the same space, not a new room.`,
      );
      break;
  }
  lines.push(BASE);
  if (d.notes) lines.push(`Owner instructions: ${d.notes}`);
  return lines.join("\n");
}

export async function callImageModel(prompt: string, image: string, apiKey: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      modalities: ["image", "text"],
      messages: [
        { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] },
      ],
    }),
  });
  if (res.status === 429) throw new Error("Rate limit reached, try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
  if (!res.ok) throw new Error(`Render failed (${res.status}).`);
  const payload = (await res.json()) as any;
  const msg = payload?.choices?.[0]?.message;
  const url: string | undefined = msg?.images?.[0]?.image_url?.url ?? msg?.images?.[0]?.url ?? undefined;
  if (!url || !url.startsWith("data:image")) throw new Error("The model did not return an image.");
  return url;
}
