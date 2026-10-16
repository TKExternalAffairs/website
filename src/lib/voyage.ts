export const isVoyagePath = (path: string) =>
  path === "/" ||
  path === "/groups" ||
  path.startsWith("/groups/") ||
  /^\/kyousan\/onegai\/?$/.test(path);
