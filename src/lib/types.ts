export type SourceType = "receipt" | "screenshot" | "manual" | "voice" | "smart_add";

export const EXPENSE_CATEGORIES = [
  "Food",
  "Shopping",
  "Transport",
  "Accommodation",
  "Entertainment",
  "Electronics",
  "Groceries",
  "Tickets",
  "Health",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAYMENT_METHODS = [
  "Cash",
  "Credit Card",
  "Debit Card",
  "Bank Transfer",
  "Apple Pay",
  "Google Pay",
  "Octopus",
  "PayMe",
  "AlipayHK",
  "WeChat Pay",
  "Other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "HKD", "CNY", "TWD", "KRW", "SGD", "AUD", "CAD",
  "THB", "VND", "MYR", "IDR", "PHP", "INR", "NZD", "CHF",
] as const;

export type Currency = (typeof CURRENCIES)[number];

export const SPLIT_TYPES = ["no_split", "equal_split", "custom_amount"] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

export const EXPENSE_STATUSES = ["draft", "needs_review", "confirmed"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_TYPES = ["one_time", "spread_across_days"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const DUPLICATE_CHECK_STATUSES = ["none", "possible_duplicate", "confirmed_not_duplicate"] as const;
export type DuplicateCheckStatus = (typeof DUPLICATE_CHECK_STATUSES)[number];

export type SplitParticipant = {
  userId: string;
  userName: string;
  share?: number;
};

export type ExpenseItem = {
  id: string;
  name: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice: number;
  category?: ExpenseCategory;
  notes?: string;
};

export type ExpenseRecord = {
  id: string;
  familyId: string;
  tripId?: string;
  userId: string;
  userName: string;
  payerId?: string;
  payerName?: string;
  merchant?: string;
  amount: number;
  currency: string;
  baseAmount?: number;
  baseCurrency?: string;
  exchangeRate?: number;
  exchangeRateDate?: string;
  category: ExpenseCategory;
  country?: string;
  date: string;
  paymentMethod?: string;
  sourceType: SourceType;
  splitType?: SplitType;
  participants?: SplitParticipant[];
  imageUrl?: string;
  aiConfidence?: number;
  notes?: string;
  items?: ExpenseItem[];
  status?: ExpenseStatus;
  duplicateCheckStatus?: DuplicateCheckStatus;
  missingFields?: string[];
  expenseType?: ExpenseType;
  spreadStartDate?: string;
  spreadEndDate?: string;
  dailyAllocatedAmount?: number;
  createdAt: string;
};

export type AIAnalysisResult = {
  merchant?: string | null;
  amount?: number | null;
  currency?: string | null;
  date?: string | null;
  country?: string | null;
  category?: ExpenseCategory | "Other";
  paymentMethod?: string | null;
  sourceType: SourceType;
  confidence: number;
  needsManualInput?: boolean;
  notes?: string;
  items?: Array<{
    name: string;
    quantity?: number | null;
    unitPrice?: number | null;
    totalPrice: number;
    category?: ExpenseCategory | null;
  }>;
};

export type LocalUser = {
  userId: string;
  userName: string;
  familyId: string;
  familyName: string;
  role: "admin" | "member";
  baseCurrency: string;
};

export type Trip = {
  tripId: string;
  tripName: string;
  familyId: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  baseCurrency: string;
  budget?: number;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  notes?: string;
};

export type CategoryRule = {
  ruleId: string;
  familyId: string;
  merchant: string;
  category: ExpenseCategory;
  createdAt: string;
};

export type Session = {
  userId: string;
  username: string;
  inviteCode: string;
  baseCurrency: string;
};

export type Party = {
  partyId: string;
  partyName: string;
  type: "private" | "public";
  partyCode?: string;
  createdBy: string;
  createdAt: string;
};

export type PartyMember = {
  userId: string;
  username: string;
  inviteCode: string;
  joinedAt: string;
};

export const BUDGET_PERIOD_TYPES = ["monthly", "trip_total"] as const;
export type BudgetPeriodType = (typeof BUDGET_PERIOD_TYPES)[number];

export type Budget = {
  id: string;
  groupId: string;
  tripId?: string;
  category?: ExpenseCategory | null;
  amount: number;
  currency: string;
  periodType: BudgetPeriodType;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};
