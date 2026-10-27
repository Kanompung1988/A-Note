export type Sheet = {
  id: string;
  title: string;
  src: string;
  /** natural size in pixels; ink is stored in this coordinate space */
  width: number;
  height: number;
  /** uploaded sheets live only in this tab, so their ink is not saved */
  local?: boolean;
  subject?: "Math" | "Science" | "English";
};

export const SAMPLE_SHEETS: Sheet[] = [
  {
    id: "linear-equations",
    title: "Worksheet 3 · Linear Equations",
    src: "/sheets/linear-equations.svg",
    width: 1240,
    height: 1754,
    subject: "Math",
  },
  {
    id: "simple-circuits",
    title: "Worksheet 5 · Simple Circuits",
    src: "/sheets/simple-circuits.svg",
    width: 1240,
    height: 1754,
    subject: "Science",
  },
  {
    id: "mangrove-reading",
    title: "Reading 2 · The Mangrove Wall",
    src: "/sheets/mangrove-reading.svg",
    width: 1240,
    height: 1754,
    subject: "English",
  },
];

export const SUBJECT_STYLES: Record<NonNullable<Sheet["subject"]>, string> = {
  Math: "bg-blue-50 text-blue-700 ring-blue-200",
  Science: "bg-teal-50 text-teal-700 ring-teal-200",
  English: "bg-violet-50 text-violet-700 ring-violet-200",
};

/** Builds a sheet from an image the learner picked. */
export async function sheetFromFile(file: File): Promise<Sheet> {
  const src = URL.createObjectURL(file);
  const img = new Image();
  img.src = src;
  await img.decode();
  return {
    id: `upload-${Date.now().toString(36)}`,
    title: file.name.replace(/\.[^.]+$/, ""),
    src,
    width: img.naturalWidth,
    height: img.naturalHeight,
    local: true,
  };
}
