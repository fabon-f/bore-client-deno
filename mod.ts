/**
 * A module to connect `bore` server.
 * @module
 */

import { TextLineStream } from "@std/streams/text-line-stream";
import { escape as escapeRegexp } from "@std/regexp/escape";

export interface BoreOptions {
  /**
   * local host to expose.
   */
  localHost?: string | undefined;
  /**
   * port on the remote server.
   */
  remotePort?: number | undefined;
  /**
   * secret for authentication.
   */
  secret?: string | undefined;
}

function createBoreArgs(
  localPort: number,
  remoteServer: string,
  options: BoreOptions,
) {
  const args = ["local"];
  if (options.localHost !== undefined) {
    args.push("--local-host", options.localHost);
  }
  if (options.remotePort !== undefined) {
    args.push("--port", options.remotePort.toString());
  }
  if (options.secret !== undefined) {
    args.push("--secret", options.secret);
  }
  args.push("--to", remoteServer, localPort.toString());
  return args;
}

export class BoreTunnel {
  #subprocess: Deno.ChildProcess;
  /**
   * The origin (scheme, host, port) where the local port is exposed.
   */
  readonly httpOrigin: string;
  /**
   * Create a tunnel and expose given port on remote server.
   *
   * @param localPort local port to expose
   * @param remoteServer remote tunnel server
   * @param options options for tunnel
   * @returns `Promise` which resolves `BoreTunnel` instance
   */
  static async connect(
    localPort: number,
    remoteServer: string,
    options: BoreOptions = {},
  ) {
    const command = new Deno.Command("bore", {
      args: createBoreArgs(localPort, remoteServer, options),
      stdout: "piped",
    });
    const process = command.spawn();
    const lineStream = process.stdout.pipeThrough(new TextDecoderStream())
      .pipeThrough(
        new TextLineStream({ allowCR: true }),
      );
    const regex = new RegExp(`${escapeRegexp(remoteServer)}:(\\d+)`);
    for await (const line of lineStream.values({ preventCancel: true })) {
      const result = line.match(regex);
      if (result) {
        const port = parseInt(result[1]);
        return new BoreTunnel(remoteServer, port, process);
      }
    }
    throw new Error();
  }
  private constructor(
    readonly remoteServer: string,
    readonly remotePort: number,
    subprocess: Deno.ChildProcess,
  ) {
    this.httpOrigin = `http://${remoteServer}:${remotePort}`;
    this.#subprocess = subprocess;
  }
  /**
   * Close a tunnel.
   */
  async close() {
    await this.#subprocess[Symbol.asyncDispose]();
  }
  async [Symbol.asyncDispose]() {
    await this.close();
  }
}
