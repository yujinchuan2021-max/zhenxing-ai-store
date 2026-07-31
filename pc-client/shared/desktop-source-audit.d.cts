export interface DesktopSourcePlan {
  url: string;
  allowedHosts: string[];
}

export interface DesktopSourceProbe {
  statusCode: number;
  finalUrl: string;
  contentType: string;
  magicHex?: string;
  exitCode: number;
  error?: string;
}

export function parseCurlProbeOutput(raw: string): Omit<DesktopSourceProbe, "exitCode">;
export function evaluateDesktopSourceProbe(input: {
  plan: DesktopSourcePlan;
  probe: DesktopSourceProbe;
}): { ok: boolean; reasons: string[]; warnings: string[] };
