import { getApiPort } from "../src/config/api-port";

describe("getApiPort", () => {
  it("defaults to 3000 when API_PORT is missing", () => {
    expect(getApiPort({})).toBe(3000);
  });

  it("uses API_PORT when it is a number", () => {
    expect(getApiPort({ API_PORT: "5555" })).toBe(5555);
  });

  it("falls back to 3000 when API_PORT is not numeric", () => {
    expect(getApiPort({ API_PORT: "nope" })).toBe(3000);
  });
});
