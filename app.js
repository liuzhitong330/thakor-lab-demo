(function () {
  "use strict";

  const data = window.UNIVERSITY_LAB_DEMO_DATA;
  if (!data) return;

  const names = Object.keys(data.animals);
  const input = document.getElementById("target-select");
  const form = document.getElementById("target-form");
  const datalist = document.getElementById("target-options");
  const suggestions = document.getElementById("suggestions");
  const svg = document.getElementById("hero-viz");
  const readout = document.getElementById("readout");
  const girThreshold = document.getElementById("gir-threshold");
  const glucoseThreshold = document.getElementById("glucose-threshold");
  let currentName = data.defaultTarget;
  let currentSignal = "gir";

  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    datalist.appendChild(option);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    button.addEventListener("click", () => render(name));
    suggestions.appendChild(button);
  });

  function svgElement(tag, attributes, text) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function pathFor(values, xScale, yScale) {
    let drawing = false;
    return values.map((value, index) => {
      if (value === null) {
        drawing = false;
        return "";
      }
      const command = drawing ? "L" : "M";
      drawing = true;
      return `${command}${xScale(data.times[index]).toFixed(1)},${yScale(value).toFixed(1)}`;
    }).join(" ");
  }

  function draw(animal, signal) {
    svg.replaceChildren();
    const width = 600;
    const height = 340;
    const margin = { left:52, right:18, top:24, bottom:48 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const series = animal[signal];
    const present = [...series.sham, ...series.pfus].filter((v) => v !== null);
    let min = Math.floor((Math.min(...present, 100) - 8) / 10) * 10;
    let max = Math.ceil((Math.max(...present, 100) + 8) / 10) * 10;
    if (max - min < 40) { min -= 10; max += 10; }
    const xMin = Math.min(...data.times);
    const xMax = Math.max(...data.times);
    const xScale = (v) => margin.left + (v - xMin) / (xMax - xMin) * plotWidth;
    const yScale = (v) => margin.top + (max - v) / (max - min) * plotHeight;

    svg.appendChild(svgElement("rect", {
      x:xScale(30), y:margin.top, width:xScale(90)-xScale(30), height:plotHeight,
      fill:"#f1f6f6"
    }));

    const ticks = 4;
    for (let i = 0; i <= ticks; i += 1) {
      const value = min + (max - min) * i / ticks;
      const y = yScale(value);
      svg.appendChild(svgElement("line", { x1:margin.left, y1:y, x2:width-margin.right, y2:y, stroke:"#e7e7e7" }));
      svg.appendChild(svgElement("text", { x:margin.left-9, y:y+4, "text-anchor":"end", class:"axis-label" }, Math.round(value)));
    }

    [-30, 0, 30, 60, 90].forEach((tick) => {
      const x = xScale(tick);
      svg.appendChild(svgElement("text", { x, y:height-21, "text-anchor":"middle", class:"axis-label" }, tick));
    });

    const baselineY = yScale(100);
    svg.appendChild(svgElement("line", { x1:margin.left, y1:baselineY, x2:width-margin.right, y2:baselineY, stroke:"#9b9b9b", "stroke-dasharray":"3 4" }));
    const zeroX = xScale(0);
    svg.appendChild(svgElement("line", { x1:zeroX, y1:margin.top, x2:zeroX, y2:margin.top+plotHeight, stroke:"#111", "stroke-width":"1.5", "stroke-dasharray":"5 4" }));
    svg.appendChild(svgElement("text", { x:zeroX+6, y:margin.top+12, class:"annotation-label" }, "stimulation / sham"));

    [
      { values:series.sham, color:"#8b8b8b", dash:"5 4" },
      { values:series.pfus, color:"#1f7a8c", dash:"" }
    ].forEach((line) => {
      svg.appendChild(svgElement("path", {
        d:pathFor(line.values, xScale, yScale), fill:"none", stroke:line.color,
        "stroke-width":"2.5", "stroke-dasharray":line.dash
      }));
      line.values.forEach((value, index) => {
        if (value === null) return;
        svg.appendChild(svgElement("circle", { cx:xScale(data.times[index]), cy:yScale(value), r:"3", fill:line.color }));
      });
    });

    svg.appendChild(svgElement("text", { x:margin.left+plotWidth/2, y:height-3, "text-anchor":"middle", class:"axis-title" }, "Minutes from intervention"));
    svg.appendChild(svgElement("text", { x:15, y:margin.top+plotHeight/2, transform:`rotate(-90 15 ${margin.top+plotHeight/2})`, "text-anchor":"middle", class:"axis-title" }, signal === "gir" ? "GIR (% baseline)" : "Blood glucose (% baseline)"));
  }

  function statusFor(animal) {
    const minUplift = Number(girThreshold.value);
    const maxDeviation = Number(glucoseThreshold.value);
    const effectPass = animal.stats.uplift >= minUplift;
    const stabilityPass = animal.stats.glucoseMAD <= maxDeviation;
    const coveragePass = animal.stats.girCoverage >= 0.8 && animal.stats.glucoseCoverage >= 0.8;
    if (effectPass && stabilityPass && coveragePass) return { label:"coherent response", detail:"retain for primary fitting review" };
    const reasons = [];
    if (!effectPass) reasons.push("GIR uplift below threshold");
    if (!stabilityPass) reasons.push("glucose stability outside threshold");
    if (!coveragePass) reasons.push("less than 80% signal coverage");
    return { label:"closer review", detail:reasons.join("; ") };
  }

  function render(name) {
    const animal = data.animals[name];
    if (!animal) {
      readout.textContent = `${name} is not in this demo. Choose one of the suggested experiments.`;
      return;
    }
    currentName = name;
    input.value = name;
    draw(animal, currentSignal);
    const status = statusFor(animal);
    const sign = animal.stats.uplift >= 0 ? "+" : "";
    readout.innerHTML = `<strong>${name}: ${status.label}.</strong> ${sign}${animal.stats.uplift.toFixed(1)}-point paired GIR uplift, ${animal.stats.glucoseMAD.toFixed(1)}-point mean glucose deviation, and ${Math.round(animal.stats.girCoverage * 100)}% GIR coverage in the 30–90 min window. <span>${status.detail}.</span>`;
    document.getElementById("metric-three").textContent = `${sign}${animal.stats.uplift.toFixed(1)}`;
    document.getElementById("metric-three-label").textContent = `${name} paired GIR uplift, points`;
    const passCount = names.filter((n) => statusFor(data.animals[n]).label === "coherent response").length;
    document.getElementById("metric-two").textContent = `${passCount} / 5`;
  }

  function renderComparison() {
    const container = document.getElementById("comparison");
    const max = 45;
    data.comparisons.forEach((item) => {
      const row = document.createElement("div");
      row.className = "model-row";
      row.innerHTML = `<div class="model-name"><strong>${item.model}</strong><span>n=${item.n} per group</span></div><div class="model-track" aria-label="${item.model}: sham ${item.sham}, pFUS ${item.pfus} ${item.unit}"><span class="model-line" style="left:${item.sham/max*100}%;width:${(item.pfus-item.sham)/max*100}%"></span><i class="dot sham-dot" style="left:${item.sham/max*100}%"></i><i class="dot pfus-dot" style="left:${item.pfus/max*100}%"></i></div><div class="model-value">+${item.delta.toFixed(2)}</div>`;
      container.appendChild(row);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render(input.value.trim());
  });
  input.addEventListener("change", () => render(input.value.trim()));
  document.querySelectorAll('input[name="signal"]').forEach((radio) => {
    radio.addEventListener("change", (event) => {
      currentSignal = event.target.value;
      render(currentName);
    });
  });
  [girThreshold, glucoseThreshold].forEach((slider) => {
    slider.addEventListener("input", () => {
      document.getElementById("gir-threshold-value").textContent = girThreshold.value;
      document.getElementById("glucose-threshold-value").textContent = glucoseThreshold.value;
      render(currentName);
    });
  });

  renderComparison();
  render(data.defaultTarget);
}());
