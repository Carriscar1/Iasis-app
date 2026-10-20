// O bundle de React Native do mqtt não traz tipos próprios. Ele exporta o
// mesmo objeto do pacote principal, então reaproveitamos a tipagem dele.
declare module 'mqtt/dist/mqtt.esm' {
  import mqtt from 'mqtt';
  export default mqtt;
}
