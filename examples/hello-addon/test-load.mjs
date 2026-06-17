import { loadBinding } from "../../dist/napi/loader.js";
import path from "node:path";

// ruta absoluta a dist-native, relativa a ESTE script
const nativeDir = path.resolve(import.meta.dirname, "dist-native");

const addon = loadBinding("hello-addon", "@brashkie/hello-addon", nativeDir);

console.log("sum(2, 3)         =", addon.sum(2, 3));
console.log("hello(\"Brashkie\") =", addon.hello("Brashkie"));