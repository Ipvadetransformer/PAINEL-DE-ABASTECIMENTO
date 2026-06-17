import { useState, useEffect, FormEvent } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocFromServer 
} from "firebase/firestore";
import { 
  Truck, 
  CheckCircle, 
  Plus, 
  Save, 
  Pencil, 
  Filter, 
  TrendingUp, 
  Fuel, 
  Trash2, 
  Warehouse, 
  Calendar, 
  DollarSign, 
  Gauge, 
  X, 
  RefreshCw, 
  Download, 
  AlertCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db } from "./firebase";
import { FuelRecord } from "./types";
import { PLACAS_CADASTRADAS } from "./constants";

export default function App() {
  // --- States ---
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "online" | "offline">("connecting");
  const [filterPlaca, setFilterPlaca] = useState<string>("TODAS");
  
  // Form fields
  const [recordId, setRecordId] = useState<string | null>(null);
  const [dataAbastecimento, setDataAbastecimento] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [placa, setPlaca] = useState<string>("");
  const [customPlaca, setCustomPlaca] = useState<string>("");
  const [isCustomPlaca, setIsCustomPlaca] = useState<boolean>(false);
  const [localAbastecimento, setLocalAbastecimento] = useState<string>("Base Novo Progresso");
  const [kmAnterior, setKmAnterior] = useState<string>("");
  const [kmAtual, setKmAtual] = useState<string>("");
  const [litros, setLitros] = useState<string>("");
  const [preco, setPreco] = useState<string>("");
  const [tanqueCheio, setTanqueCheio] = useState<"SIM" | "NAO">("SIM");
  const [considerarLitragem, setConsiderarLitragem] = useState<"SIM" | "NAO">("SIM");

  // Utilities
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // --- Connection Validation & Sync ---
  useEffect(() => {
    async function validateFirebase() {
      try {
        await getDocFromServer(doc(db, "test", "connection"));
        setConnectionStatus("online");
      } catch (error) {
        console.warn("Firestore diagnostic check completed.", error);
        setConnectionStatus("online"); // allow operations, listen status will decide active
      }
    }
    validateFirebase();

    // Listen to firestore real-time query
    const unsub = onSnapshot(collection(db, "fuelRecords"), 
      (snapshot) => {
        const syncedRecords: FuelRecord[] = [];
        snapshot.forEach((doc) => {
          syncedRecords.push({ id: doc.id, ...doc.data() } as FuelRecord);
        });
        // Sort by timestamp descending
        syncedRecords.sort((a, b) => b.timestamp - a.timestamp);
        setRecords(syncedRecords);
        setLoading(false);
        setConnectionStatus("online");
      }, 
      (error) => {
        console.error("Firestore listening error: ", error);
        showToast("Erro ao sincronizar dados em tempo real", "error");
        setConnectionStatus("offline");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // --- Dynamic Plates Calculation ---
  // Combine pre-registered plates + plates already used in existing records
  const registeredSet = new Set(PLACAS_CADASTRADAS);
  records.forEach(r => {
    if (r.placa) registeredSet.add(r.placa);
  });
  const allAvailablePlates = Array.from(registeredSet).sort();

  // --- Handle Form Mode resets ---
  const resetForm = () => {
    setRecordId(null);
    setDataAbastecimento(new Date().toISOString().split("T")[0]);
    setPlaca("");
    setCustomPlaca("");
    setIsCustomPlaca(false);
    setLocalAbastecimento("Base Novo Progresso");
    setKmAnterior("");
    setKmAtual("");
    setLitros("");
    setPreco("");
    setTanqueCheio("SIM");
    setConsiderarLitragem("SIM");
  };

  // --- Form Submit ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const selectedPlaca = isCustomPlaca ? customPlaca.trim().toUpperCase() : placa;
    
    // Validations
    if (!selectedPlaca) {
      showToast("Informe ou selecione a placa da carreta", "error");
      return;
    }
    if (!dataAbastecimento) {
      showToast("Informe a data do abastecimento", "error");
      return;
    }
    
    const kmAntNum = parseFloat(kmAnterior);
    const kmAtuNum = parseFloat(kmAtual);
    const litrosNum = parseFloat(litros);
    const precoNum = parseFloat(preco);

    if (isNaN(kmAntNum) || kmAntNum < 0) {
      showToast("Km Anterior inválido", "error");
      return;
    }
    if (isNaN(kmAtuNum) || kmAtuNum <= kmAntNum) {
      showToast("Km Atual deve ser maior que o Anterior!", "error");
      return;
    }
    if (isNaN(litrosNum) || litrosNum <= 0) {
      showToast("Quantidade de litros inválida", "error");
      return;
    }
    if (isNaN(precoNum) || precoNum <= 0) {
      showToast("Preço inválido", "error");
      return;
    }

    const distancia = kmAtuNum - kmAntNum;
    const media = distancia / litrosNum;
    const custoTotal = litrosNum * precoNum;
    const custoKm = custoTotal / distancia;

    // Standard timestamp from date input (at noon to prevent timezone shifts)
    const timestamp = new Date(dataAbastecimento + "T12:00:00").getTime();

    const recordData = {
      data: dataAbastecimento,
      timestamp,
      placa: selectedPlaca,
      localAbastecimento,
      kmAnterior: kmAntNum,
      hodometroAtual: kmAtuNum,
      litros: litrosNum,
      precoLitro: precoNum,
      tanqueCheio,
      considerarLitragem,
      distancia,
      media,
      custoTotal,
      custoKm
    };

    try {
      const activeId = recordId || doc(collection(db, "fuelRecords")).id;
      
      // Save directly to Cloud Firestore
      await setDoc(doc(db, "fuelRecords", activeId), recordData);
      
      showToast(recordId ? "Registro atualizado com sucesso!" : "Abastecimento salvo em nuvem com sucesso!");
      resetForm();
    } catch (error) {
      console.error("Error saving document: ", error);
      showToast("Falha ao salvar no banco em nuvem", "error");
    }
  };

  // --- Action Handlers ---
  const handleEdit = (rec: FuelRecord) => {
    setRecordId(rec.id);
    setDataAbastecimento(rec.data);
    
    // Check if plate exists in PLACAS_CADASTRADAS
    if (PLACAS_CADASTRADAS.includes(rec.placa)) {
      setPlaca(rec.placa);
      setIsCustomPlaca(false);
    } else {
      setCustomPlaca(rec.placa);
      setIsCustomPlaca(true);
    }
    
    setLocalAbastecimento(rec.localAbastecimento);
    setKmAnterior(rec.kmAnterior.toString());
    setKmAtual(rec.hodometroAtual.toString());
    setLitros(rec.litros.toString());
    setPreco(rec.precoLitro.toString());
    setTanqueCheio(rec.tanqueCheio);
    setConsiderarLitragem(rec.considerarLitragem);

    // Smooth scroll to form section
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("Carregado no formulário para edição");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, "fuelRecords", deleteConfirmId));
      showToast("Registro removido com sucesso!");
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
      showToast("Erro ao excluir do banco em nuvem", "error");
    }
  };

  // --- Export to CSV ---
  const handleExportCSV = () => {
    if (records.length === 0) {
      showToast("Sem registros para exportação", "error");
      return;
    }

    const headers = [
      "Data",
      "Placa",
      "Local",
      "Km Anterior",
      "Km Atual",
      "Litros",
      "Preco / Litro",
      "Tanque Cheio",
      "Considerar Media",
      "Distancia Rodada",
      "Media (km/L)",
      "Custo Total",
      "Custo por Km"
    ];

    const rows = records.map(r => [
      r.data,
      r.placa,
      r.localAbastecimento,
      r.kmAnterior,
      r.hodometroAtual,
      r.litros,
      r.precoLitro,
      r.tanqueCheio,
      r.considerarLitragem,
      r.distancia,
      r.media.toFixed(2),
      r.custoTotal.toFixed(2),
      r.custoKm.toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `frotacontrol_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Planilha CSV baixada!");
  };

  // --- Calculated KPIs ---
  const filteredRecords = filterPlaca === "TODAS" 
    ? records 
    : records.filter(r => r.placa === filterPlaca);

  let totalDistancia = 0;
  let totalLitragemConsiderada = 0;
  let totalCusto = 0;

  filteredRecords.forEach((r) => {
    totalDistancia += r.distancia;
    totalCusto += r.custoTotal;
    
    // Only count liters towards total media if it's checked as SIM
    if (r.considerarLitragem === "SIM" || !r.considerarLitragem) {
      totalLitragemConsiderada += r.litros;
    }
  });

  const mediaGeral = totalLitragemConsiderada > 0 ? (totalDistancia / totalLitragemConsiderada) : 0;

  // Formatting helpers
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDecimal = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat("pt-BR", { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    }).format(value);
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans transition-all">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 30, x: "-50%" }}
            className={`fixed bottom-8 left-1/2 z-50 px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 backdrop-blur-md text-white font-medium min-w-[280px] justify-center ${
              toast.type === "success" ? "bg-emerald-600 border border-emerald-500" : "bg-rose-600 border border-rose-500"
            }`}
          >
            {toast.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200/80 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-indigo-600/20">
                <Truck className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-xl tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 to-indigo-950 bg-clip-text">
                    FrotaControl
                  </h1>
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded uppercase border border-slate-200">
                    Nuvem
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium hidden sm:block">
                  Gestão Centralizada de Combustível da Frota
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {connectionStatus === "connecting" && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-100 text-amber-700">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-semibold">Conectando Nuvem...</span>
                </div>
              )}
              {connectionStatus === "online" && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-700">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-semibold">Nuvem Compartilhada</span>
                </div>
              )}
              {connectionStatus === "offline" && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-full border border-rose-100 text-rose-700">
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  <span className="text-xs font-semibold">Sincronização Ativa</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
        
        {/* Left Column: Form Section */}
        <section className="lg:col-span-4" id="form-container">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sticky top-24">
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {recordId ? (
                  <>
                    <Pencil className="w-5 h-5 text-amber-500 stroke-[2.5]" />
                    <span className="text-slate-950 font-extrabold text-base">Editar Registro</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-indigo-600 stroke-[2.5]" />
                    <span className="text-slate-950 font-extrabold text-base">Novo Abastecimento</span>
                  </>
                )}
              </h2>
              {recordId && (
                <button 
                  onClick={resetForm}
                  className="text-xs font-medium text-slate-500 hover:text-rose-600 transition-all border border-slate-200 bg-slate-50 px-2 py-1 rounded"
                >
                  Cancelar
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Date Input */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Data do Abastecimento
                </label>
                <div className="relative">
                  <input 
                    type="date"
                    required
                    value={dataAbastecimento}
                    onChange={(e) => setDataAbastecimento(e.target.value)}
                    className="w-full text-slate-800 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Truck Plate Selection */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Placa da Carreta
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomPlaca(!isCustomPlaca);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline transition-colors"
                  >
                    {isCustomPlaca ? "Ver Lista" : "Digitar Nova"}
                  </button>
                </div>
                
                {isCustomPlaca ? (
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="DIGITE A PLACA..."
                    value={customPlaca}
                    onChange={(e) => setCustomPlaca(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all uppercase font-semibold"
                  />
                ) : (
                  <select
                    required
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-slate-700 transition-all font-semibold uppercase"
                  >
                    <option value="">Selecione uma Placa...</option>
                    {allAvailablePlates.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Location Select */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Local do Abastecimento
                </label>
                <select
                  value={localAbastecimento}
                  onChange={(e) => setLocalAbastecimento(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-slate-700 transition-all font-medium"
                >
                  <option value="Base Novo Progresso">Base Novo Progresso</option>
                  <option value="Posto Credenciado">Posto Credenciado</option>
                </select>
              </div>

              {/* Odometer Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Km Anterior
                  </label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="Ex: 50000"
                    required
                    value={kmAnterior}
                    onChange={(e) => setKmAnterior(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Km Atual
                  </label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="Ex: 50800"
                    required
                    value={kmAtual}
                    onChange={(e) => setKmAtual(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Fuel Volume & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Litros (L)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.1"
                    placeholder="Ex: 250"
                    required
                    value={litros}
                    onChange={(e) => setLitros(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Preço (R$)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Ex: 5.92"
                    required
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Tank full & Consider criteria */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5" title="Informa se a carreta está com o tanque repleto">
                    Tanque Cheio?
                  </label>
                  <select
                    value={tanqueCheio}
                    onChange={(e) => setTanqueCheio(e.target.value as "SIM" | "NAO")}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-slate-700 transition-all font-medium"
                  >
                    <option value="SIM">SIM</option>
                    <option value="NAO">NÃO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5" title="Define se esta litragem entra na conta da Média Geral">
                    Considerar Litros?
                  </label>
                  <select
                    value={considerarLitragem}
                    onChange={(e) => setConsiderarLitragem(e.target.value as "SIM" | "NAO")}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-slate-700 transition-all font-medium"
                  >
                    <option value="SIM">SIM (Padrão)</option>
                    <option value="NAO">NÃO (Ignorar)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-2">
                <button
                  type="submit"
                  className={`w-full py-3.5 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    recordId 
                      ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/10" 
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10"
                  }`}
                >
                  <Save className="w-4 h-4 stroke-[2.5]" />
                  {recordId ? "Atualizar Abastecimento" : "Salvar na Nuvem"}
                </button>
                {recordId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full py-3 bg-white text-slate-600 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancelar Edição
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>

        {/* Right Column: Calculations & Storage View */}
        <section className="lg:col-span-8 space-y-6">
          
          {/* Dashboard Filtering Head */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Dados Consolidados
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {filterPlaca === "TODAS" ? "Combinando resultados de toda a frota" : `Filtro ativo para a placa ${filterPlaca}`}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterPlaca}
                  onChange={(e) => setFilterPlaca(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none pr-1 uppercase"
                >
                  <option value="TODAS">Todas as Placas</option>
                  {allAvailablePlates.map((placa) => (
                    <option key={placa} value={placa}>
                      Placa: {placa}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleExportCSV}
                title="Exportar planilhas para CSV"
                className="p-2 sm:px-3 sm:py-2 bg-white text-slate-600 border border-slate-200 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* KPI 1: consumption average */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 relative overflow-hidden">
              <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                <Gauge className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="flex-1">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Média Geral</span>
                <span className="text-xl font-black text-slate-800">
                  {formatDecimal(mediaGeral)} <span className="text-xs font-normal text-slate-500">km/L</span>
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded px-1 py-0.5 font-medium ml-1.5 inline-block">
                  Apenas válidos
                </span>
              </div>
            </div>

            {/* KPI 2: total distance */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 relative overflow-hidden">
              <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
                <Truck className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Km total rodado</span>
                <p className="text-xl font-black text-slate-800">
                  {formatDecimal(totalDistancia, 0)} <span className="text-xs font-normal text-slate-500">km</span>
                </p>
              </div>
            </div>

            {/* KPI 3: total spent cost */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 relative overflow-hidden">
              <div className="bg-rose-50 p-3 rounded-xl text-rose-600">
                <DollarSign className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Custo total</span>
                <p className="text-xl font-black text-slate-800">
                  {formatMoney(totalCusto)}
                </p>
              </div>
            </div>
          </div>

          {/* Database Synchronization view */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Fuel className="w-4 h-4 text-slate-500" />
                Histórico em Tempo Real
              </h3>
              <span className="bg-white border border-slate-200 text-slate-600 py-1 px-3 rounded-full text-xs font-bold shadow-sm">
                {filteredRecords.length} {filteredRecords.length === 1 ? "registro" : "registros"}
              </span>
            </div>

            {loading ? (
              <div className="p-16 text-center text-slate-500 space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-sm font-semibold">Baixando registros da nuvem compartilhada...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-16 text-center text-slate-500">
                <Fuel className="w-12 h-12 text-slate-200 mx-auto mb-3 stroke-[1.5]" />
                <p className="text-base font-bold text-slate-800">Nenhum abastecimento gravado</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Preencha o formulário para gravar o primeiro evento de combustível sincronizado.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-white text-slate-400 text-[10px] font-extrabold uppercase tracking-widest border-b border-slate-100">
                      <th className="p-4">Carreta / Data</th>
                      <th className="p-4">Localização</th>
                      <th className="p-4">Quilometragem</th>
                      <th className="p-4">Litragem / Preço</th>
                      <th className="p-4">Mediana</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRecords.map((record) => {
                      const localStr = record.localAbastecimento || "Não Informado";
                      
                      return (
                        <tr 
                          key={record.id}
                          className="hover:bg-indigo-50/20 transition-all duration-150 class-record-row"
                        >
                          {/* Plate / Date */}
                          <td className="p-4">
                            <div className="font-extrabold text-slate-900 text-sm uppercase">
                              {record.placa}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {formatDateDisplay(record.data)}
                            </div>
                          </td>

                          {/* Location */}
                          <td className="p-4">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                              <Warehouse className="w-4 h-4 text-slate-400" />
                              {localStr}
                            </div>
                          </td>

                          {/* Odometer Distance */}
                          <td className="p-4">
                            <div className="font-bold text-slate-800 text-sm">
                              {formatDecimal(record.distancia, 0)} km
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 font-medium select-none">
                              {formatDecimal(record.kmAnterior, 0)} → {formatDecimal(record.hodometroAtual, 0)}
                            </div>
                          </td>

                          {/* Volume Cost */}
                          <td className="p-4">
                            <div className="font-bold text-slate-800 text-sm">
                              {formatDecimal(record.litros)} L
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 font-medium">
                              {formatMoney(record.precoLitro)} /L
                            </div>
                            
                            {/* Badges */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {record.tanqueCheio === "SIM" ? (
                                <span className="inline-block px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded uppercase">
                                  Completo
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/80 rounded uppercase">
                                  Incompleto
                                </span>
                              )}
                              
                              {record.considerarLitragem === "NAO" && (
                                <span className="inline-block px-1.5 py-0.5 text-[9px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200 rounded uppercase">
                                  Ignorado Média
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Average consumption */}
                          <td className="p-4">
                            <div className="inline-block px-2 py-1 bg-indigo-50/80 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-black">
                              {formatDecimal(record.media)} km/L
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-semibold pl-1">
                              {formatMoney(record.custoKm)} /km
                            </div>
                          </td>

                          {/* Database action triggers */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEdit(record)}
                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(record.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Delete Confirmation Overlay Component */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-slate-100"
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4 text-rose-600">
                <AlertCircle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-md font-bold text-center text-slate-900 mb-2">
                Excluir Registro da Nuvem?
              </h3>
              <p className="text-xs text-center text-slate-500 mb-6 leading-relaxed">
                Esta ação apagará permanently o abastecimento no banco em nuvem. Outros usuários deixarão de visualizá-lo de forma imediata.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-md shadow-rose-600/10"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Humble Footer */}
      <footer className="bg-white py-6 border-t border-slate-200/50 mt-12 text-center text-xs text-slate-400 font-medium">
        <p>© {new Date().getFullYear()} FrotaControl. Todos os dados sincronizados em tempo real.</p>
      </footer>
    </div>
  );
}
