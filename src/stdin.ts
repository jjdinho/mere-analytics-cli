/**
 * Read all data from stdin. Returns an empty string when stdin is a TTY
 * (i.e. nothing was piped in).
 */
export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("error", () => resolve(data));
    process.stdin.on("end", () => resolve(data));
  });
}
