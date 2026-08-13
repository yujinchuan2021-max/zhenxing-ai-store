export type ManagedCliTerminalAction = {
  executable: string;
  args: string[];
  options: {
    cwd: string;
    detached: true;
    shell: false;
    stdio: "ignore";
    windowsHide: false;
  };
};

export function createManagedCliTerminalAction(input: {
  productId: string;
  plan: { commandName?: string };
  status: {
    installed: boolean;
    managed: boolean;
    directory: string;
  };
  commandExecutable: string;
  exists: (candidate: string) => boolean;
  realpath: (candidate: string) => string;
}): ManagedCliTerminalAction | null;
