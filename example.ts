import { BoreTunnel } from "./mod.ts";

const localPort = 2857;

await using _server = Deno.serve(
  { port: localPort },
  () => new Response("It works!"),
);

await using tunnel = await BoreTunnel.connect(localPort, "bore.pub");
console.log(`Tunnel address: ${tunnel.httpOrigin}`);

const response = await fetch(tunnel.httpOrigin);
console.log(await response.text());
