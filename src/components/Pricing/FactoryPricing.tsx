import React, { useState, useMemo } from 'react';
import Layout from '../Layout/Layout';
import { useStore } from '../../store/useStore';
import { PRODUCTS } from '../../data/products';
import { fmtINR } from '../../utils/format';

type FactoryPricingParams = {
  wheatPrice: number;
  branRecovery: number;
  wheatWastage: number;
  branSellingPrice: number;
  dailyProductionMt: number;
  workingDays: number;
  monthlySalary: number;
  monthlyElectricity: number;
  monthlyEmi: number;
  monthlyRepair: number;
  safetyMargin: number;
  profitMarginBySku?: Record<string, number>;
};

const normalizePercentInput = (value: number) => {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return 0;
  return n >= 1 ? n / 100 : n;
};

const percentDisplay = (value: unknown, fallback: number) => {
  const n = Number(value ?? fallback);
  if (Number.isNaN(n)) return fallback;
  return n >= 1 ? n : n * 100;
};

function computeCosts(params: any) {
  const p = { ...params };
  const dailyMt = Number(p.dailyProductionMt || 10);
  const days = Number(p.workingDays || 28);
  const monthlyProductionKg = dailyMt * 1000 * days;
  const branRecoveryPct = normalizePercentInput(Number(p.branRecovery || 0));
  const branSelling = Number(p.branSellingPrice || 0);
  const wheatPrice = Number(p.wheatPrice || 0);
  const wheatWastagePct = normalizePercentInput(Number(p.wheatWastage || 0));

  const branIncomePerKg = (branRecoveryPct / 100) * branSelling;
  const effectiveWheatCost = wheatPrice - branIncomePerKg;
  // Avoid division by zero when waste is 100% or more
  const wastageCostPerKg = wheatWastagePct >= 0.99 ? 0 : wheatPrice * (wheatWastagePct / (1 - wheatWastagePct));

  const salaryCostPerKg = monthlyProductionKg > 0 ? (Number(p.monthlySalary || 0) / monthlyProductionKg) : 0;
  const electricityCostPerKg = monthlyProductionKg > 0 ? (Number(p.monthlyElectricity || 0) / monthlyProductionKg) : 0;
  const emiCostPerKg = monthlyProductionKg > 0 ? (Number(p.monthlyEmi || 0) / monthlyProductionKg) : 0;
  const repairCostPerKg = monthlyProductionKg > 0 ? (Number(p.monthlyRepair || 0) / monthlyProductionKg) : 0;

  const baseManufacturingCost = (effectiveWheatCost || 0) + (wastageCostPerKg || 0) + (salaryCostPerKg || 0) + (electricityCostPerKg || 0) + (emiCostPerKg || 0) + (repairCostPerKg || 0);

  return {
    monthlyProductionKg,
    branIncomePerKg: branIncomePerKg || 0,
    effectiveWheatCost: effectiveWheatCost || 0,
    wastageCostPerKg: wastageCostPerKg || 0,
    salaryCostPerKg: salaryCostPerKg || 0,
    electricityCostPerKg: electricityCostPerKg || 0,
    emiCostPerKg: emiCostPerKg || 0,
    repairCostPerKg: repairCostPerKg || 0,
    baseManufacturingCost: baseManufacturingCost || 0,
  };
}

export default function FactoryPricing() {
  const factoryParams = useStore(s => s.factoryPricingParams);
  const factoryPrices = useStore(s => s.factoryPrices);
  const setFactoryPricingParams = useStore(s => s.setFactoryPricingParams);
  const setFactoryPrices = useStore(s => s.setFactoryPrices);

  const [localParams, setLocalParams] = useState<FactoryPricingParams>({
    wheatPrice: Number(factoryParams.wheatPrice ?? 23.1),
    branRecovery: percentDisplay(factoryParams.branRecovery, 5),
    wheatWastage: percentDisplay(factoryParams.wheatWastage, 1),
    branSellingPrice: Number(factoryParams.branSellingPrice ?? 24),
    dailyProductionMt: Number(factoryParams.dailyProductionMt ?? 10),
    workingDays: Number(factoryParams.workingDays ?? 28),
    monthlySalary: Number(factoryParams.monthlySalary ?? 200000),
    monthlyElectricity: Number(factoryParams.monthlyElectricity ?? 200000),
    monthlyEmi: Number(factoryParams.monthlyEmi ?? 200000),
    monthlyRepair: Number(factoryParams.monthlyRepair ?? 30000),
    safetyMargin: Number(factoryParams.safetyMargin ?? 0.1),
    profitMarginBySku: {},
  });

  const costs = useMemo(() => computeCosts(localParams), [localParams]);

  const packagingSkus = PRODUCTS.filter(p => p.product === 'Shikharji Atta' && !p.hidden);

  // Default packaging costs (Rs/kg) from factory pricing
  const DEFAULT_PACKAGING_COSTS: Record<string, number> = {
    'WF-50K_pkg_cost': 0.37,   // 50 kg Bag
    'WF-30K_pkg_cost': 0.43,   // 30 kg Bag (Rs 13/bag ÷ 30 kg)
    'WF-26K_pkg_cost': 0.60,   // 26 kg Bag
    'WF-25K_pkg_cost': 0.60,   // 25 kg Bag (same as 26 kg)
    'WF-10H_pkg_cost': 1.20,   // 10 kg Handle Bag
    'WF-10P_pkg_cost': 1.35,   // 10 kg Pouch
    'WF-5P_pkg_cost': 2.00,    // 5 kg Pouch
    'WF-5H_pkg_cost': 1.85,    // 5 kg Handle Bag
  };

  const [localPrices, setLocalPrices] = useState<Record<string, number>>(() => ({ 
    ...DEFAULT_PACKAGING_COSTS,
    ...factoryPrices,
  }));

  const handleApply = () => {
    // compute selling price per kg and bag price for each atta SKU
    const safety = Number(localParams.safetyMargin || 0);
    const newPrices: Record<string, number> = {};
    for (const sku of packagingSkus) {
      const packagingCostPerKg = Number(localPrices[sku.id + '_pkg_cost'] || 0);
      const finalFactoryCostPerKg = costs.baseManufacturingCost + packagingCostPerKg;
      const defaultProfitPct = 1.5;
      const profitPct = Number(localParams.profitMarginBySku?.[sku.id] ?? defaultProfitPct) / 100;
      const sellingPerKg = finalFactoryCostPerKg * (1 + profitPct) + safety;
      const bagPrice = parseFloat((sellingPerKg * sku.weight).toFixed(2));
      newPrices[sku.id] = bagPrice;
    }
    setFactoryPricingParams(localParams);
    setFactoryPrices(newPrices);
    setLocalPrices(prev => ({ ...prev, ...newPrices }));
    alert('Factory prices applied to price list and saved locally.');
  };

  return (
    <Layout title="Factory Pricing">
      <div className="max-w-3xl space-y-6">
        <div className="bg-white p-4 rounded-2xl border">
          <h3 className="font-semibold mb-2">Input Parameters</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Wheat Price (Rs/kg)
              <input type="number" value={localParams.wheatPrice} onChange={e => setLocalParams((p: FactoryPricingParams) => ({ ...p, wheatPrice: Number(e.target.value) }))} className="w-full mt-1 p-2 border rounded" />
            </label>
            <label className="text-sm">Bran Recovery (%)
              <input type="number" value={localParams.branRecovery} onChange={e => setLocalParams((p: FactoryPricingParams) => ({ ...p, branRecovery: Number(e.target.value) }))} className="w-full mt-1 p-2 border rounded" />
            </label>
            <label className="text-sm">Wheat Wastage (%)
              <input type="number" value={localParams.wheatWastage} onChange={e => setLocalParams((p: FactoryPricingParams) => ({ ...p, wheatWastage: Number(e.target.value) }))} className="w-full mt-1 p-2 border rounded" />
            </label>
            <label className="text-sm">Bran Selling Price (Rs/kg)
              <input type="number" value={localParams.branSellingPrice} onChange={e => setLocalParams((p: FactoryPricingParams) => ({ ...p, branSellingPrice: Number(e.target.value) }))} className="w-full mt-1 p-2 border rounded" />
            </label>
            <label className="text-sm">Daily Production (MT)
              <input type="number" value={localParams.dailyProductionMt} onChange={e => setLocalParams((p: FactoryPricingParams) => ({ ...p, dailyProductionMt: Number(e.target.value) }))} className="w-full mt-1 p-2 border rounded" />
            </label>
            <label className="text-sm">Working Days / Month
              <input type="number" value={localParams.workingDays} onChange={e => setLocalParams((p: FactoryPricingParams) => ({ ...p, workingDays: Number(e.target.value) }))} className="w-full mt-1 p-2 border rounded" />
            </label>
            <label className="text-sm">Monthly Salary (Rs)
              <input type="number" value={localParams.monthlySalary} onChange={e => setLocalParams((p: FactoryPricingParams) => ({ ...p, monthlySalary: Number(e.target.value) }))} className="w-full mt-1 p-2 border rounded" />
            </label>
            <label className="text-sm">Monthly Electricity (Rs)
              <input type="number" value={localParams.monthlyElectricity} onChange={e => setLocalParams((p: FactoryPricingParams) => ({ ...p, monthlyElectricity: Number(e.target.value) }))} className="w-full mt-1 p-2 border rounded" />
            </label>
            <label className="text-sm">Monthly EMI (Rs)
              <input type="number" value={localParams.monthlyEmi} onChange={e => setLocalParams((p: FactoryPricingParams) => ({ ...p, monthlyEmi: Number(e.target.value) }))} className="w-full mt-1 p-2 border rounded" />
            </label>
            <label className="text-sm">Monthly Repair & Maintenance (Rs)
              <input type="number" value={localParams.monthlyRepair} onChange={e => setLocalParams((p: FactoryPricingParams) => ({ ...p, monthlyRepair: Number(e.target.value) }))} className="w-full mt-1 p-2 border rounded" />
            </label>
            <label className="text-sm">Operational Safety Margin (Rs/kg)
              <input type="number" value={localParams.safetyMargin} onChange={e => setLocalParams((p: FactoryPricingParams) => ({ ...p, safetyMargin: Number(e.target.value) }))} className="w-full mt-1 p-2 border rounded" />
            </label>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border">
          <h3 className="font-semibold mb-2">Computed Costs (per kg)</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
            <div>Monthly Production: {Math.round(costs.monthlyProductionKg)} kg</div>
            <div>Bran Income: {fmtINR(costs.branIncomePerKg)}</div>
            <div>Effective Wheat Cost: {fmtINR(costs.effectiveWheatCost)}</div>
            <div>Wastage Cost: {fmtINR(costs.wastageCostPerKg)}</div>
            <div>Salary / kg: {fmtINR(costs.salaryCostPerKg)}</div>
            <div>Electricity / kg: {fmtINR(costs.electricityCostPerKg)}</div>
            <div>EMI / kg: {fmtINR(costs.emiCostPerKg)}</div>
            <div>Repair / kg: {fmtINR(costs.repairCostPerKg)}</div>
            <div className="col-span-2 font-semibold">Base Manufacturing Cost: {fmtINR(costs.baseManufacturingCost)}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border">
          <h3 className="font-semibold mb-2">Packaging Table (Shikharji Atta)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="px-2 py-1">Variant</th>
                <th className="px-2 py-1">Weight</th>
                <th className="px-2 py-1">Packaging Cost (Rs/kg)</th>
                <th className="px-2 py-1">Profit Margin (%)</th>
                <th className="px-2 py-1">Selling Price (Rs/kg)</th>
                <th className="px-2 py-1">Actual Bag Price (₹)</th>
                <th className="px-2 py-1">Delivery Bag (30 kg)</th>
                <th className="px-2 py-1">Per Quintal Profit (₹)</th>
              </tr>
            </thead>
            <tbody>
              {packagingSkus.map(sku => {
                const pkgKey = sku.id + '_pkg_cost';
                const pkgCost = Number(localPrices[pkgKey] || 0);
                const finalFactoryCostPerKg = costs.baseManufacturingCost + pkgCost;
                const defaultProfitPct = 1.5;
                const profitPct = Number(localParams.profitMarginBySku?.[sku.id] ?? defaultProfitPct) / 100;
                const sellingPerKg = finalFactoryCostPerKg * (1 + profitPct) + Number(localParams.safetyMargin || 0);
                const bagPrice = parseFloat((sellingPerKg * sku.weight).toFixed(2));
                const deliveryBagPrice = sku.weight <= 10 ? parseFloat((sellingPerKg * 30).toFixed(2)) : undefined;
                const profitPercentValue = Number(localParams.profitMarginBySku?.[sku.id] ?? defaultProfitPct);
                const profitPerKg = sellingPerKg - finalFactoryCostPerKg;
                const perQuintalProfit = parseFloat((profitPerKg * 100).toFixed(2));
                return (
                  <tr key={sku.id} className="border-t">
                    <td className="px-2 py-2">{sku.variant}</td>
                    <td className="px-2 py-2">{sku.weight} kg</td>
                    <td className="px-2 py-2">
                      <input type="number" value={pkgCost || ''} onChange={e => setLocalPrices(p => ({ ...p, [pkgKey]: Number(e.target.value) }))} className="w-32 p-1 border rounded" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" value={profitPercentValue} onChange={e => setLocalParams((p: FactoryPricingParams) => ({
                        ...p,
                        profitMarginBySku: { ...p.profitMarginBySku, [sku.id]: Number(e.target.value) },
                      }))} className="w-20 p-1 border rounded" />
                    </td>
                    <td className="px-2 py-2 font-medium">{fmtINR(sellingPerKg)}</td>
                    <td className="px-2 py-2 font-medium">{fmtINR(bagPrice)}</td>
                    <td className="px-2 py-2 font-medium">{deliveryBagPrice != null ? fmtINR(deliveryBagPrice) : '—'}</td>
                    <td className="px-2 py-2 font-medium text-green-700">{fmtINR(perQuintalProfit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4 flex gap-2">
            <button onClick={handleApply} className="px-4 py-2 bg-indigo-600 text-white rounded">Apply to Price List</button>
            <button onClick={() => {
              // export current factory prices as JSON download
              const data = { ...factoryPrices };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'factory_prices.json'; a.click(); URL.revokeObjectURL(url);
            }} className="px-4 py-2 border rounded">Export JSON</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
