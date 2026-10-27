export type Sheet = {
  id: string;
  title: string;
  src: string;
  /** natural size in pixels; ink is stored in this coordinate space */
  width: number;
  height: number;
  /** uploaded sheets live only in this tab, so their ink is not saved */
  local?: boolean;
};

export const SAMPLE_SHEETS: Sheet[] = [
  {
    id: "linear-equations-m1",
    title: "ใบงานที่ 3 · สมการเชิงเส้นตัวแปรเดียว",
    src: "/sheets/linear-equations-m1.svg",
    width: 1240,
    height: 1754,
  },
];

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
