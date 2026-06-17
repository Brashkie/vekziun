#![deny(clippy::all)]

use napi_derive::napi;

/// Función mínima de prueba: suma dos números.
/// napi-derive genera el binding y el .d.ts automáticamente desde esta anotación.
#[napi]
pub fn sum(a: i32, b: i32) -> i32 {
  a + b
}

/// Saludo para confirmar que el binding carga y devuelve strings.
#[napi]
pub fn hello(name: String) -> String {
  format!("Hola {name}, desde Rust vía Vekziun")
}
