import { IconName } from "@/config/types/IconName";

export type DemoFlowId = "swap" | "convert" | "liquidity" | "listing";

export type DemoStep = {
  key: string;
  // Action steps only advance after the highlighted control is clicked. Read-only steps
  // enable Next straight away.
  action: boolean;
  // Action steps that stand for a transaction play the pretend signing state first.
  sign?: boolean;
};

export type DemoFlow = {
  id: DemoFlowId;
  icon: IconName;
  // Where "Try it for real" sends people when the flow is done.
  liveHref: string;
  steps: DemoStep[];
};

export const DEMO_FLOWS: DemoFlow[] = [
  {
    id: "swap",
    icon: "swap",
    liveHref: "/swap",
    steps: [
      { key: "choose", action: true },
      { key: "approve", action: true, sign: true },
      { key: "swap", action: true, sign: true },
      { key: "compare", action: false },
    ],
  },
  {
    id: "convert",
    icon: "convert",
    liveHref: "/converter",
    steps: [
      { key: "pick", action: true },
      { key: "convert", action: true, sign: true },
      { key: "back", action: true, sign: true },
    ],
  },
  {
    id: "liquidity",
    icon: "pools",
    liveHref: "/add",
    steps: [
      { key: "pair", action: false },
      { key: "fee", action: true },
      { key: "range", action: true },
      { key: "deposit", action: false },
      { key: "add", action: true, sign: true },
    ],
  },
  {
    id: "listing",
    icon: "listing",
    liveHref: "/token-listing",
    steps: [
      { key: "token", action: false },
      { key: "contract", action: true },
      { key: "list", action: true, sign: true },
      { key: "order", action: true },
      { key: "open", action: true, sign: true },
      { key: "watch", action: false },
    ],
  },
];

export function getDemoFlow(id: string): DemoFlow | undefined {
  return DEMO_FLOWS.find((flow) => flow.id === id);
}

export function nextUnfinishedFlow(
  completed: DemoFlowId[],
  after?: DemoFlowId,
): DemoFlow | undefined {
  const start = after ? DEMO_FLOWS.findIndex((flow) => flow.id === after) + 1 : 0;
  const ordered = [...DEMO_FLOWS.slice(start), ...DEMO_FLOWS.slice(0, start)];
  return ordered.find((flow) => flow.id !== after && !completed.includes(flow.id));
}

// How long the pretend "Proceed in your wallet" state lasts after an action click.
export const DEMO_SIGNING_MS = 1500;

// Pretend market price used by the swap and liquidity flows.
export const DEMO_D223_PER_USDT = 124.312;

export const DEMO_LIQUIDITY_DEPOSIT = {
  usdt20: 100,
  // Match the displayed quote, without binary multiplication residue at the exact balance.
  d223: Number((100 * DEMO_D223_PER_USDT).toFixed(4)),
} as const;
