// La tienda ya no guarda el DNI de los usuarios.
// Lo elimina de las cuentas creadas antes de este cambio (solo hace algo la primera vez).
async function purgeDni(User) {
  const { modifiedCount } = await User.collection.updateMany({ dni: { $exists: true } }, { $unset: { dni: '' } });
  if (modifiedCount) console.log(`🧹 DNI eliminado de ${modifiedCount} usuario(s)`);
  return modifiedCount;
}

module.exports = { purgeDni };
