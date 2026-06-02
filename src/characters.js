// Available characters with icons/emoji
export const CHARACTERS = [
  { id: 'dog', name: 'Chó', icon: '🐕', emoji: '🐕' },
  { id: 'cat', name: 'Mèo', icon: '🐈', emoji: '🐈' },
  { id: 'penguin', name: 'Chim Cánh Cụt', icon: '🐧', emoji: '🐧' },
  { id: 'panda', name: 'Gấu Trúc', icon: '🐼', emoji: '🐼' },
  { id: 'monkey', name: 'Khỉ', icon: '🐵', emoji: '🐵' },
  { id: 'elephant', name: 'Voi', icon: '🐘', emoji: '🐘' },
  { id: 'lion', name: 'Sư Tử', icon: '🦁', emoji: '🦁' },
  { id: 'tiger', name: 'Hổ', icon: '🐯', emoji: '🐯' },
  { id: 'rabbit', name: 'Thỏ', icon: '🐰', emoji: '🐰' },
  { id: 'bear', name: 'Gấu', icon: '🐻', emoji: '🐻' },
  { id: 'fox', name: 'Cáo', icon: '🦊', emoji: '🦊' },
  { id: 'frog', name: 'Ếu', icon: '🐸', emoji: '🐸' }
];

export const getCharacterById = (id) => CHARACTERS.find(c => c.id === id) || CHARACTERS[0];

export const getCharacterIcon = (characterId) => {
  return getCharacterById(characterId).icon;
};
