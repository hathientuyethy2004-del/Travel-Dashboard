export const CHART_COLORS = {
  blue: "#0079F2", // Deep Teal/Ocean inspired blue
  purple: "#795EFF",
  green: "#009118",
  red: "#A60808",
  pink: "#ec4899",
  orange: "#f97316",
  yellow: "#eab308",
  teal: "#0d9488",
  cyan: "#0891b2"
};

export const CHART_COLOR_LIST = [
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.green,
  CHART_COLORS.red,
  CHART_COLORS.pink,
  CHART_COLORS.teal,
  CHART_COLORS.cyan,
  CHART_COLORS.orange
];

export const DATA_SOURCES = ["Smart Travel POI Pipeline", "Bronze Data Lake"];

const CITY_NAME_MAP: Record<string, string> = {
  "Thành phố Hồ Chí Minh": "Ho Chi Minh City",
  "Hồ Chí Minh": "Ho Chi Minh City",
  "TP. Hồ Chí Minh": "Ho Chi Minh City",
  "Hà Nội": "Hanoi",
  "Thành phố Đà Nẵng": "Da Nang",
  "Đà Nẵng": "Da Nang",
  "Nha Trang": "Nha Trang",
  "Đà Lạt": "Da Lat",
  "Huế": "Hue",
  "Thành phố Hải Phòng": "Hai Phong",
  "Hải Phòng": "Hai Phong",
  "Cần Thơ": "Can Tho",
  "Vũng Tàu": "Vung Tau",
  "Quy Nhơn": "Quy Nhon",
};

const PIPELINE_NAME_MAP: Record<string, string> = {
  "Làm giàu Google raw": "Google Raw Enrichment",
};

export function formatCityName(name?: string | null, fallback?: string | null): string {
  const value = name || fallback || "";
  return CITY_NAME_MAP[value] ?? value;
}

export function formatPipelineName(name?: string | null): string {
  const value = name || "Pipeline";
  return PIPELINE_NAME_MAP[value] ?? value.replace(/_/g, " ");
}

export function formatNumber(value: number, type: "currency" | "percent" | "compact" | "decimal"): string {
  switch (type) {
    case "currency": 
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    case "percent": 
      return new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
    case "compact": 
      return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
    case "decimal":
      return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }
}
