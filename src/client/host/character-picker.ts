import { CHARACTER_DESIGNS, DEFAULT_CHARACTERS, characterDesign, isCharacterId } from '../../shared/characters';
import { characterPortraits } from './characters';

const STORAGE_KEY='pickle-garden.characters.v1';
export function mountCharacterPicker(container: HTMLElement, preview: (id:string)=>void) {
  const selected: string[]=[...DEFAULT_CHARACTERS];
  try {
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)??'null');
    if(Array.isArray(saved)) for(let i=0;i<2;i++) if(isCharacterId(saved[i])) selected[i]=saved[i];
  } catch { /* Storage may be blocked; selections still work for this visit. */ }
  container.innerHTML=`<div class="character-slots" aria-label="Nhân vật đã chọn"></div>
    <p class="character-note">6 nhân vật · Anime, chibi & cute · Cùng khả năng thi đấu</p>
    <dialog class="character-dialog" aria-labelledby="roster-title">
      <div class="roster-heading"><div><span class="eyebrow">GARDEN FRIENDS</span><h2 id="roster-title">Chọn bạn đồng hành</h2></div><button type="button" class="quiet close-roster" aria-label="Đóng bộ chọn nhân vật">Đóng</button></div>
      <p class="roster-target"></p>
      <div class="roster-grid"></div>
      <p class="roster-feedback" role="status" aria-live="polite"></p>
      <button type="button" class="finish-roster">Xong, về sảnh</button>
    </dialog>`;
  const slots=container.querySelector<HTMLElement>('.character-slots')!;
  const dialog=container.querySelector<HTMLDialogElement>('dialog')!;
  let active=0;
  let built=false;
  function render() {
    slots.innerHTML=selected.map((id,i)=>{
      const d=characterDesign(id);
      return `<button type="button" class="character-slot" data-character-slot="${i}" data-character-id="${d.id}" aria-label="Chọn nhân vật ${i===0?'của bạn':'người chơi 2 hoặc máy'}"><span>${i===0?'Bạn · Người chơi 1':'Người chơi 2 / Máy'}</span><strong>${d.name}</strong><small>${d.gender} · ${d.style} · Đổi</small></button>`;
    }).join('');
    for(const button of dialog.querySelectorAll<HTMLButtonElement>('[data-character]')) {
      button.setAttribute('aria-pressed',String(button.dataset.character===selected[active]));
    }
    container.querySelector('.roster-target')!.textContent=active===0?'Chọn nhân vật của bạn. Lựa chọn được lưu tự động.':'Chọn nhân vật cho người chơi 2 hoặc đối thủ máy. Khi online, đối thủ tự chọn nhân vật.';
    container.querySelector('.roster-feedback')!.textContent=`Đã chọn ${characterDesign(selected[active]).name}`;
  }
  slots.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLElement>('[data-character-slot]');
    if(!button)return;
    active=Number(button.dataset.characterSlot);
    if(!built) {
      let portraits=new Map<string,string>();
      try {portraits=characterPortraits();} catch { /* Text cards remain selectable if a second GL context is unavailable. */ }
      container.querySelector('.roster-grid')!.innerHTML=CHARACTER_DESIGNS.map(d=>`
        <button type="button" class="character-card" data-character="${d.id}" aria-pressed="false">
          <span class="character-art" style="--portrait-bg:#${d.shirt.toString(16).padStart(6,'0')}25">${portraits.has(d.id)?`<img src="${portraits.get(d.id)}" alt="${d.name}, ${d.description}" width="240" height="260">`:`<span>${d.name}</span>`}</span>
          <span class="character-card-title">${d.name}<small>${d.gender} · ${d.style}</small></span>
          <span class="character-description">${d.description}</span>
        </button>`).join('');
      built=true;
    }
    render();preview(selected[active]);dialog.showModal();
  });
  dialog.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLElement>('[data-character]');
    if(!button)return;
    const id=button.dataset.character;
    if(!isCharacterId(id))return;
    selected[active]=id;
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify(selected));} catch { /* Optional persistence. */ }
    preview(id);render();
  });
  dialog.addEventListener('close',()=>preview(selected[0]));
  container.querySelector('.close-roster')!.addEventListener('click',()=>dialog.close());
  container.querySelector('.finish-roster')!.addEventListener('click',()=>dialog.close());
  render();preview(selected[0]);
  return {getSelection: (): [string,string]=>[selected[0],selected[1]]};
}
