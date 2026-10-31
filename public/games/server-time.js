// The iPad's clock won't match the server's exactly, so timed games read the server's time from here.
let offset = 0;

export function setServerTime(time) {
  offset = time - Date.now();
}

export const serverNow = () => Date.now() + offset;
