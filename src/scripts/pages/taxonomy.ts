/* Market-map grid: clicking a cell opens the detail panel beneath it. */
import { TAX } from "../../data/taxonomy";
import { withBase } from "../../lib/base";

const detail = document.getElementById("taxdetail");

function select(ri: number, ci: number) {
  document.querySelectorAll(".tax .cell").forEach((c) => c.classList.remove("sel"));
  document.getElementById(`cell-${ri}-${ci}`)?.classList.add("sel");
  if (!detail) return;

  const r = TAX.rows[ri];
  const c = r.cells[ci];
  const chips = c.who
    .split("·")
    .map((w: string) => `<span class="txchip">${w.trim()}</span>`)
    .join("");

  detail.innerHTML = `<div class="taxdetail">
    <div class="txdhead"><span class="tag ${ci === 1 ? "t-open" : "t-gated"}">${TAX.cols[ci].split(" — ")[0]}</span><span class="tag" style="background:rgba(109,91,184,.25);color:#cfc2ff">${r.name}</span>${c.us ? '<span class="tag t-open">POLARIS LIVES HERE</span>' : ""}</div>
    <h3>${c.h}</h3><p>${c.d}</p>
    <div class="txwho"><span class="lblw">Who lives here</span>${chips}</div>
    ${c.v ? `<p class="txver"><b>Our verdict:</b> ${c.v}</p>` : ""}
    <p style="margin-top:14px"><a class="btn accent" href="${withBase(`/${c.link}`)}">Drill down →</a> &nbsp; <a href="${withBase("/compare/hub")}">See this row in the compare matrix →</a></p>
  </div>`;
}

document.querySelectorAll<HTMLElement>("[data-tax-cell]").forEach((cell) =>
  cell.addEventListener("click", () =>
    select(Number(cell.dataset.row), Number(cell.dataset.col))
  )
);
