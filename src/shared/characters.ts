export interface CharacterDesign {
  id: string; name: string; gender: 'Nam' | 'Nữ'; style: 'Anime' | 'Chibi' | 'Cute';
  description: string; skin: number; hair: number; shirt: number; accent: number;
  hairstyle: 'spikes' | 'twintails' | 'bob' | 'swoop' | 'bunny' | 'bear';
}
export const CHARACTER_DESIGNS: readonly CharacterDesign[] = [
  { id: 'ren', name: 'Ren', gender: 'Nam', style: 'Anime', description: 'Tóc xanh dựng · áo khoác thể thao', skin: 0xf2c9aa, hair: 0x344862, shirt: 0x6486b4, accent: 0xf4d181, hairstyle: 'spikes' },
  { id: 'aiko', name: 'Aiko', gender: 'Nữ', style: 'Anime', description: 'Tóc đôi hồng · đồng phục lavender', skin: 0xf7d4ba, hair: 0xb96683, shirt: 0x9b8ac4, accent: 0xffe0a0, hairstyle: 'twintails' },
  { id: 'bao', name: 'Bảo', gender: 'Nam', style: 'Chibi', description: 'Tóc bồng caramel · hoodie bạc hà', skin: 0xc98d65, hair: 0x5c3930, shirt: 0x7da58c, accent: 0xf3d5a1, hairstyle: 'swoop' },
  { id: 'mimi', name: 'Mimi', gender: 'Nữ', style: 'Chibi', description: 'Tóc bob tím · váy tennis đào', skin: 0xf2c6a5, hair: 0x635576, shirt: 0xd88f83, accent: 0xffe2b3, hairstyle: 'bob' },
  { id: 'kuma', name: 'Kuma', gender: 'Nam', style: 'Cute', description: 'Mũ tai gấu · bộ đồ mật ong', skin: 0xdca37d, hair: 0x714a35, shirt: 0xc69a5d, accent: 0xffe6b3, hairstyle: 'bear' },
  { id: 'yuki', name: 'Yuki', gender: 'Nữ', style: 'Cute', description: 'Mũ tai thỏ · bộ đồ xanh mây', skin: 0xf5d5bf, hair: 0xe0ded7, shirt: 0x83b5c5, accent: 0xf4b7bd, hairstyle: 'bunny' },
];
export const DEFAULT_CHARACTERS = ['ren', 'aiko'] as const;
export function isCharacterId(id: unknown): id is string {
  return typeof id === 'string' && CHARACTER_DESIGNS.some(c => c.id === id);
}
export function characterDesign(id: string): CharacterDesign {
  return CHARACTER_DESIGNS.find(c => c.id === id) ?? CHARACTER_DESIGNS[0]!;
}
