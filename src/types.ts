export interface FuelRecord {
  id: string;
  data: string; // Format: "YYYY-MM-DD"
  timestamp: number; // Epoch milliseconds
  placa: string;
  localAbastecimento: string;
  kmAnterior: number;
  hodometroAtual: number;
  litros: number;
  precoLitro: number;
  tanqueCheio: "SIM" | "NAO";
  considerarLitragem: "SIM" | "NAO";
  distancia: number;
  media: number;
  custoTotal: number;
  custoKm: number;
}
