import { z } from "zod";

export const drawInstructionSchema = z.object({
  shapes: z.array(
    z.object({
      type: z.enum(["rectangle", "circle", "line", "triangle", "text"]),
      x: z.number().describe("X coordinate (0-800)"),
      y: z.number().describe("Y coordinate (0-600)"),
      width: z.number().optional().describe("Width for rectangle"),
      height: z.number().optional().describe("Height for rectangle"),
      radius: z.number().optional().describe("Radius for circle"),
      x2: z.number().optional().describe("End X for line"),
      y2: z.number().optional().describe("End Y for line"),
      text: z.string().optional().describe("Text content"),
      fillColor: z.string().optional().describe("Fill color (hex or name)"),
      strokeColor: z.string().optional().describe("Stroke color (hex or name)"),
      strokeWidth: z.number().optional().describe("Stroke width"),
    })
  ),
  backgroundColor: z.string().nullish().describe("Canvas background color"),
});

export type DrawInstruction = z.infer<typeof drawInstructionSchema>;
