import { projectModel } from './model.mjs';
import { MODEL_INPUTS, MODEL_SCENARIOS } from './model-inputs.js';

export const DEFAULT_STATE = Object.freeze({
  cut: 0, price: 1, buying: 1, buybacks: MODEL_INPUTS.yearlyBuybacks.value, growth: 0
});
const limits = {
  cut: [0, 1, 1], price: [0.25, 5, 0.01], buying: [-1, 10, 0.01],
  buybacks: [0, 100_000_000, 100_000], growth: [-0.5, 1, 0.01]
};
export function scenarioState(name) {
  const input = Object.hasOwn(MODEL_SCENARIOS, name) ? MODEL_SCENARIOS[name] : null;
  if (!input) throw new Error('Unknown scenario.');
  return { cut: input.cut, price: input.price / MODEL_INPUTS.price.value,
    buying: input.yearlyNetBuying / MODEL_INPUTS.yearlyNetBuying.value,
    buybacks: input.yearlyBuybacks, growth: input.yearlyBuyingGrowth };
}
const presets = Object.keys(MODEL_SCENARIOS).map(scenarioState);
export function parseState(search) {
  const query = new URLSearchParams(search), state = { ...DEFAULT_STATE };
  for (const [key, [min, max, step]] of Object.entries(limits)) {
    const values = query.getAll(key), raw = values[0];
    if (values.length !== 1 || !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || (key === 'cut' && value !== 0 && value !== 1)) continue;
    const bounded = Math.min(max, Math.max(min, value));
    // Keep evidence-based defaults/presets exact; custom URL settings use slider steps.
    state[key] = value === DEFAULT_STATE[key] || presets.some(p => value === p[key])
      ? bounded : Number((min + Math.round((bounded - min) / step) * step).toFixed(6));
  }
  return state;
}
export function stateQuery(state) {
  return new URLSearchParams(Object.keys(limits).map(key => [key, String(state[key])])).toString();
}
const compact = value => Number.isFinite(value)
  ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value) : 'Not defined';
const dollars = value => Number.isFinite(value) ? `${value < 0 ? '−' : ''}$${compact(Math.abs(value))}` : 'Not defined';
const priceText = value => Number.isFinite(value)
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value) : 'Not defined';
const percent = value => Number.isFinite(value)
  ? new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(value) : 'Not defined';

export const CHART_HEIGHT = 240;
const round = n => Math.round(n * 100) / 100;
// Drawn in CSS pixels at the container's width, so the 14px CSS labels are never scaled.
export function barChart(years, width = 640) {
  width = Math.max(240, Math.floor(Number.isFinite(width) ? width : 640));
  const totals = years.map(row => row.absorbedNear + row.burnedNear);
  const high = Math.max(1, ...years.map(row => row.newNear), ...totals), low = Math.min(0, ...totals);
  const top = 32, plot = CHART_HEIGHT - top - 32;
  const y = value => top + (high - value) / (high - low) * plot, zero = y(0);
  const slot = (width - 16) / years.length, barWidth = Math.min(24, Math.floor(slot * 0.3)), gap = 4;
  const bars = years.map((row, i) => {
    const center = 8 + slot * (i + 0.5), x = center - barWidth - gap / 2;
    const bar = (value, offset, cls, title) =>
      `<rect x="${round(x + offset)}" y="${round(Math.min(zero, y(value)))}" width="${barWidth}" height="${round(Math.abs(zero - y(value)))}" class="${cls}"><title>${title}: ${compact(value)} NEAR</title></rect>`;
    return `${bar(row.newNear, 0, 'bar-new', 'New NEAR')}${bar(totals[i], barWidth + gap, 'bar-absorbed', 'Absorbed plus burned')}
      <text x="${round(center)}" y="${CHART_HEIGHT - 8}" text-anchor="middle">${row.year}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${CHART_HEIGHT}" width="${width}" height="${CHART_HEIGHT}" role="img" aria-labelledby="bar-title bar-description">
    <title id="bar-title">Annual new NEAR against absorbed plus burned NEAR</title>
    <desc id="bar-description">Paired bars share one NEAR scale. Exact values and coverage are in the table under The path to 2031.</desc>
    <text x="8" y="18">${compact(high)} NEAR</text>
    <line x1="8" x2="${width - 8}" y1="${round(zero)}" y2="${round(zero)}" class="chart-axis"/>
    ${bars}</svg>`;
}

// Pure rendering: all variable markup comes from finite numbers, never URL text.
export function renderModel(rawState, inputs = MODEL_INPUTS, chartWidth = 640) {
  const state = parseState(stateQuery(rawState));
  const values = Object.fromEntries(Object.entries(inputs).map(([key, entry]) => [key, entry.value]));
  const result = projectModel({
    ...values, price: values.price * state.price, yearlyNetBuying: values.yearlyNetBuying * state.buying,
    yearlyBuybacks: state.buybacks, yearlyBuyingGrowth: state.growth, cut: state.cut
  });
  const last = result.years.at(-1), price = values.price * state.price;
  const neededUsd = Math.max(0, last.newNear - last.burnedNear) * price;
  const multiple = values.yearlyNetBuying > 0 ? neededUsd / values.yearlyNetBuying : null;
  const tableRows = result.years.map(row => `<tr>
    <td data-label="Year">${row.year}</td>
    <td data-label="New NEAR">${compact(row.newNear)}</td>
    <td data-label="Burned">${compact(row.burnedNear)}</td>
    <td data-label="Absorbed">${compact(row.absorbedNear)}</td>
    <td data-label="Coverage">${percent(row.coverage)}</td>
    <td data-label="Net float change">${compact(row.netFloatChange)}</td>
    <td data-label="Break-even price">${priceText(row.breakEvenPrice)}</td>
  </tr>`).join('');
  return {
    state, years: result.years, neededUsd, multiple, tableRows, chart: barChart(result.years, chartWidth),
    coverage: percent(last.coverage),
    explanation: last.coverage === null ? 'Coverage cannot be defined without new issuance.'
      : `Under these assumptions, buying and burn ${last.coverage >= 1 ? 'fully absorb' : 'do not fully absorb'} new NEAR in 2031.`,
    needed: dollars(neededUsd),
    comparison: multiple === null ? "Today's net buying is not positive, so a multiple is not defined."
      : `${compact(multiple)}× today's final annual net buying. Includes net buying and buybacks, after burn.`,
    activation: result.activationAssumption,
    controls: {
      price: `${priceText(price)} · ${state.price}× latest close`,
      buying: `${dollars(values.yearlyNetBuying * state.buying)} / year · ${compact(state.buying)}× current`,
      buybacks: `${dollars(state.buybacks)} / year`,
      growth: `${percent(state.growth)} / year`
    }
  };
}

function mount() {
  const byId = id => document.getElementById(id);
  const sourceLabels = {
    startingSupply: 'Starting supply', startMonth: 'Start month', realizedShare: 'Realized issuance share',
    yearlyBurn: 'Yearly burn', price: 'Latest close', yearlyNetBuying: 'Net buying', yearlyBuybacks: 'Buybacks'
  };
  for (const [key, entry] of Object.entries(MODEL_INPUTS)) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    const value = key === 'startMonth' ? 'November 2026' : key === 'realizedShare' ? percent(entry.value)
      : key === 'price' ? priceText(entry.value) : key === 'yearlyNetBuying' || key === 'yearlyBuybacks'
        ? dollars(entry.value) : `${compact(entry.value)} NEAR`;
    dt.textContent = `${sourceLabels[key]}: ${value} (${entry.status}; starting assumption)`;
    dd.textContent = entry.source;
    byId('sources').append(dt, dd);
  }
  let state = parseState(window.location.search);
  const chart = byId('chart'), chartWidth = () => Math.floor(chart.getBoundingClientRect().width) || 640;
  let drawnWidth = 0;
  function update() {
    drawnWidth = chartWidth();
    const view = renderModel(state, MODEL_INPUTS, drawnWidth);
    state = view.state;
    byId('coverage').textContent = view.coverage;
    byId('explanation').textContent = view.explanation;
    byId('needed').textContent = view.needed;
    byId('multiple').textContent = view.comparison;
    byId('year-rows').innerHTML = view.tableRows;
    chart.innerHTML = view.chart;
    byId('activation').textContent = view.activation;
    byId('activation').hidden = state.cut === 0;
    byId('cut').checked = state.cut === 1;
    for (const name of Object.keys(MODEL_SCENARIOS)) {
      const preset = scenarioState(name);
      byId(`scenario-${name}`).setAttribute('aria-pressed',
        String(Object.keys(limits).every(key => state[key] === preset[key])));
    }
    for (const key of ['price', 'buying', 'buybacks', 'growth']) {
      byId(key).value = state[key];
      byId(`${key}-value`).textContent = view.controls[key];
      byId(key).setAttribute('aria-valuetext', view.controls[key]);
    }
    const url = new URL(window.location.href);
    url.search = stateQuery(state);
    window.history.replaceState(null, '', url);
  }
  for (const key of Object.keys(limits)) {
    byId(key).addEventListener('input', () => {
      state[key] = key === 'cut' ? Number(byId(key).checked) : Number(byId(key).value);
      update();
    });
  }
  byId('reset').addEventListener('click', () => { state = { ...DEFAULT_STATE }; update(); });
  for (const name of Object.keys(MODEL_SCENARIOS)) {
    byId(`scenario-${name}`).addEventListener('click', () => { state = scenarioState(name); update(); });
  }
  window.addEventListener('popstate', () => { state = parseState(window.location.search); update(); });
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      if (chartWidth() !== drawnWidth) {
        drawnWidth = chartWidth();
        chart.innerHTML = renderModel(state, MODEL_INPUTS, drawnWidth).chart;
      }
    }).observe(chart);
  }
  update();
}
if (typeof document !== 'undefined' && document.getElementById('year-rows')) mount();
