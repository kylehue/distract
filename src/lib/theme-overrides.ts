import type { GlobalThemeOverrides } from "naive-ui";

const baseThemeOverrides: GlobalThemeOverrides = {
   Tooltip: {
      padding: "4px 8px",
      peers: { Popover: { fontSize: "0.8em" } },
   },
   Tree: {
      nodeHeight: "34px",
      lineHeight: "0px",
      nodeWrapperPadding: "0",
   },
};

export const lightThemeOverrides: GlobalThemeOverrides = {
   ...baseThemeOverrides,
   common: {
      primaryColor: "#8661ff",
      primaryColorHover: "#a27dff",
      primaryColorPressed: "#7e3ee6",
      primaryColorSuppl: "rgb(64, 40, 143)",
   },
};

export const darkThemeOverrides: GlobalThemeOverrides = {
   ...baseThemeOverrides,
   common: {
      primaryColor: "#a27dff",
      primaryColorHover: "#af8fff",
      primaryColorPressed: "#9b61ff",
      primaryColorSuppl: "rgb(94, 67, 161)",
   },
};
