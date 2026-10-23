import {renderImageLineCanvas} from "../core/image-line.js";

export const imageLineChart={
  id:"image-line",
  labelKey:"viz.imageLine",
  validate:project=>Array.isArray(project.data?.items),
  async render(project,root){
    const canvas=await renderImageLineCanvas(project);
    canvas.className="image-line-visual";
    canvas.style.width="100%";
    canvas.style.height="100%";
    canvas.style.display="block";
    root.replaceChildren(canvas);
  }
};
