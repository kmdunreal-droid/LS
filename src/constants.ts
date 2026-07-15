import { FormulaSettings } from "./types";

export const DEFAULT_FORMULA_SETTINGS: FormulaSettings = {
  shopName: "ZEESHAN TIKKA",
  baseRawRate: 600, // Rs. 600 per kg
  items: {
    boneless: {
      name: "Boneless",
      expression: "supply * 1.8 + 100",
    },
    chickenTikka: {
      name: "Chicken Tikka",
      expression: "supply * 1.4 + 60",
    },
    thigh: {
      name: "Thigh",
      expression: "supply * 1.3 + 40",
    },
    leg: {
      name: "Leg Piece",
      expression: "supply * 1.25 + 40",
    },
    wings: {
      name: "Wings",
      expression: "supply * 0.9 + 30",
    },
    wingsV: {
      name: "Wings V",
      expression: "supply * 1.0 + 35",
    },
  },
  supplierUsername: "zeeshan",
  supplierPassword: "786",
  supplierAccessEnabled: true,
  gitRepositoryUrl: "https://github.com/kmdunreal-droid/ladger-chicken.git",
};

export const SUPPLY_CATEGORIES = [
  "Whole Chicken",
  "Chest / Boneless",
  "Leg / Thigh",
  "Wings",
  "Wings V",
  "Boneless",
  "Chicken Tikka",
  "Thigh",
  "Leg Piece",
];

export const EXPENSE_CATEGORIES = [
  "Spices & Marinade",
  "Coal & Energy",
  "Staff Salaries",
  "Rent & Utilities",
  "Packaging & Consumables",
  "Other Operational Expenses",
];
