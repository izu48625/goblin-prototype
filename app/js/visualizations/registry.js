import {rankingCard} from "./ranking-card.js";
import {statCard} from "./stat-card.js";
import {quadrant} from "./quadrant.js";
import {barChart} from "./bar.js";
import {radarChart} from "./radar.js";
import {dotChart} from "./dot.js";
import {ringGauge} from "./ring.js";
import {tierList} from "./tier-list.js";
import {heatmap} from "./heatmap.js";
import {scatterChart} from "./scatter.js";
import {rangeChart} from "./range.js";
import {waffleChart} from "./waffle.js";
import {statBoard} from "./stat-board.js";

export const VISUALIZATIONS={
  [rankingCard.id]:rankingCard,
  [statCard.id]:statCard,
  [quadrant.id]:quadrant,
  [barChart.id]:barChart,
  [radarChart.id]:radarChart,
  [dotChart.id]:dotChart,
  [ringGauge.id]:ringGauge,
  [tierList.id]:tierList,
  [heatmap.id]:heatmap,
  [scatterChart.id]:scatterChart,
  [rangeChart.id]:rangeChart,
  [waffleChart.id]:waffleChart,
  [statBoard.id]:statBoard
};

export function getVisualization(type){
  return VISUALIZATIONS[type]||null;
}
