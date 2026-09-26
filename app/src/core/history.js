export class History{
  constructor(initial,limit=50){
    this.past=[];
    this.present=structuredClone(initial);
    this.future=[];
    this.limit=limit;
  }

  commit(next){
    this.past.push(structuredClone(this.present));
    if(this.past.length>this.limit)this.past.shift();
    this.present=structuredClone(next);
    this.future=[];
    return structuredClone(this.present);
  }

  replace(next){
    this.present=structuredClone(next);
    return structuredClone(this.present);
  }

  undo(){
    if(!this.past.length)return null;
    this.future.unshift(structuredClone(this.present));
    this.present=this.past.pop();
    return structuredClone(this.present);
  }

  redo(){
    if(!this.future.length)return null;
    this.past.push(structuredClone(this.present));
    this.present=this.future.shift();
    return structuredClone(this.present);
  }

  canUndo(){return this.past.length>0}
  canRedo(){return this.future.length>0}
}
