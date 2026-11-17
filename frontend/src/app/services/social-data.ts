import type { ChatMessage, DatabaseUser } from './chat';

export const avatarOf = (seed: string) => `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;

type Seed = Omit<DatabaseUser, 'avatar' | 'handle' | 'accountCode'> & { code: number; handle: string };

const SEEDS: Seed[] = [
  { id: 'db1', username: 'mèo mướp mướp mèo', handle: 'meomuopmuopmeo1212', code: 3285, isOnline: true, personality: 'cute', country: 'Việt Nam',
    bio: 'Mèo thích săn boss, ngủ nướng và gom đồ hiếm. Rủ mình chơi chung nha!', friendIds: ['db2', 'db3', 'db7', 'db8'],
    wishlistIds: ['elden-ring', 'hades-2'], libraryIds: ['stardew-valley', 'hollow-knight', 'god-of-war'] },
  { id: 'db2', username: 'mèo mướp', handle: 'meomuop_pro', code: 3282, isOnline: true, personality: 'chill', country: 'Việt Nam',
    bio: 'Chơi cho vui, thắng thua không quan trọng. Thích game thế giới mở.', friendIds: ['db1', 'db6'],
    wishlistIds: ['black-myth-wukong', 'silksong'], libraryIds: ['witcher-3', 'rdr2'] },
  { id: 'db3', username: 'nguyenduyen.231006', handle: 'nguyenduyen231006', code: 10293, isOnline: true, personality: 'smart', country: 'Việt Nam',
    bio: 'Sinh viên MIS UEL, mê game mô phỏng và xây dựng thành phố.', friendIds: ['db1', 'db12', 'db13'],
    wishlistIds: ['forza-horizon-5'], libraryIds: ['cities-skylines-ii', 'the-sims-4', 'planet-coaster'] },
  { id: 'db4', username: 'sat_thu_bo_duo', handle: 'satthuboduo', code: 4412, isOnline: true, personality: 'pro', country: 'Hàn Quốc',
    bio: 'FPS là chân ái. Headshot là nghệ thuật.', friendIds: ['db6', 'db13'],
    wishlistIds: ['cyberpunk-2077'], libraryIds: ['counter-strike-2', 'apex-legends', 'pubg'] },
  { id: 'db5', username: 'bao_an_96', handle: 'baoan96', code: 5071, isOnline: false, lastOnlineText: 'Lần cuối trên mạng 9 giờ, 37 phút trước', personality: 'calm', country: 'Việt Nam',
    bio: 'Người chơi trầm tính, mê RPG cốt truyện dài.', friendIds: ['db6', 'db8', 'db9'],
    wishlistIds: ['rdr2'], libraryIds: ['witcher-3', 'elden-ring', 'baldurs-gate-3'] },
  { id: 'db6', username: 'gamer_x', handle: 'gamerx', code: 7780, isOnline: true, personality: 'hype', country: 'Việt Nam',
    bio: 'Cuồng Dota, cuồng đồng đội. Ai rảnh vào lobby với mình!', friendIds: ['db2', 'db4', 'db5', 'db9'],
    wishlistIds: ['borderlands-4', 'baldurs-gate-3'], libraryIds: ['dota-2', 'counter-strike-2'] },
  { id: 'db7', username: 'kem_dau_tay', handle: 'kemdautay', code: 6104, isOnline: true, personality: 'sweet', country: 'Nhật Bản',
    bio: 'Cày farm cả ngày, trồng cà rốt cũng vui.', friendIds: ['db1', 'db8', 'db15'],
    wishlistIds: ['the-sims-4'], libraryIds: ['stardew-valley', 'planet-coaster'] },
  { id: 'db8', username: 'rong_con_96', handle: 'rongcon96', code: 8821, isOnline: true, personality: 'funny', country: 'Việt Nam',
    bio: 'Thợ săn quái vật bán thời gian, hài hước toàn thời gian.', friendIds: ['db1', 'db5', 'db7', 'db9'],
    wishlistIds: ['black-myth-wukong'], libraryIds: ['monster-hunter-world', 'god-of-war'] },
  { id: 'db9', username: 'hoang_tu_gau', handle: 'hoangtugau', code: 9930, isOnline: true, personality: 'meme', country: 'Việt Nam',
    bio: 'Sợ ma nhưng vẫn chơi game kinh dị. Hay hét to.', friendIds: ['db5', 'db6', 'db8', 'db14'],
    wishlistIds: ['resident-evil-4-remake', 'outlast'], libraryIds: ['dead-by-daylight', 'phasmophobia'] },
  { id: 'db10', username: 'tieu_long_nu', handle: 'tieulongnu', code: 2217, isOnline: false, lastOnlineText: 'Lần cuối trên mạng 2 ngày trước', personality: 'smart', country: 'Singapore',
    bio: 'Thích game chiến thuật theo lượt. Thư viện của mình ở chế độ riêng tư.', friendIds: ['db3', 'db15'], hideLibrary: true,
    wishlistIds: ['silksong'], libraryIds: ['clair-obscur', 'hades-2'] },
  { id: 'db11', username: 'pho_bo_dac_biet', handle: 'phobodacbiet', code: 1456, isOnline: true, personality: 'foodie', country: 'Việt Nam',
    bio: 'Vừa chơi vừa ăn. Đừng hỏi tại sao tay mình dính nước phở.', friendIds: ['db12', 'db14'],
    wishlistIds: ['forza-horizon-5'], libraryIds: ['ea-fc-24'] },
  { id: 'db12', username: 'ngoc_trinh_09', handle: 'ngoctrinh09', code: 3340, isOnline: true, personality: 'chatty', country: 'Việt Nam',
    bio: 'Nói nhiều nhưng dễ thương. Có mặt ở mọi nhóm chat.', friendIds: ['db3', 'db11', 'db13'],
    wishlistIds: ['the-sims-4', 'stardew-valley'], libraryIds: ['planet-coaster'], hideWishlist: true },
  { id: 'db13', username: 'thanh_tung_gaming', handle: 'thanhtunggaming', code: 7712, isOnline: true, personality: 'host', country: 'Việt Nam',
    bio: 'Streamer tập sự, 12 người xem (có 10 người là bạn). Follow mình nha!', friendIds: ['db3', 'db4', 'db12'],
    wishlistIds: ['cyberpunk-2077', 'elden-ring'], libraryIds: ['gta-v', 'god-of-war', 'dota-2'] },
  { id: 'db14', username: 'bun_cha_hn', handle: 'bunchahn', code: 5598, isOnline: true, personality: 'chill', country: 'Việt Nam',
    bio: 'Dân Hà Nội chính hiệu, thích game co-op thư giãn.', friendIds: ['db9', 'db11'],
    wishlistIds: ['phasmophobia'], libraryIds: ['stardew-valley', 'hollow-knight'] },
  { id: 'db15', username: 'co_gai_muc_tim', handle: 'cogaimuctim', code: 4081, isOnline: true, personality: 'sweet', country: 'Hàn Quốc',
    bio: 'Màu tím là nhất! Sưu tầm game indie dễ thương.', friendIds: ['db7', 'db10'],
    wishlistIds: ['hades-2', 'clair-obscur'], libraryIds: ['hollow-knight', 'silksong'] }
];

/** Danh bạ người dùng của hệ thống: ai được gửi lời mời cũng sẽ chấp nhận (giả lập). */
export const DIRECTORY: DatabaseUser[] = SEEDS.map(({ code, ...rest }) => ({
  ...rest,
  avatar: avatarOf(rest.id + rest.handle),
  accountCode: `CUS-${code}`,
  autoAccept: true
}));

export const directoryUser = (id: string): DatabaseUser => DIRECTORY.find(u => u.id === id) as DatabaseUser;

/* ===================== Lời thoại giả lập ===================== */

export type ScriptLine = [senderId: string, time: string, text: string];

/** Chuyển kịch bản thành tin nhắn. 'me' là chính người dùng. */
export function buildHistory(lines: ScriptLine[], self: { name: string; avatar: string }, idPrefix: string): ChatMessage[] {
  return lines.map(([senderId, time, text], i) => {
    const isSelf = senderId === 'me';
    const user = isSelf ? null : directoryUser(senderId);
    return {
      id: `${idPrefix}-${i}`,
      senderId,
      sender: isSelf ? self.name : (user?.username ?? senderId),
      avatar: isSelf ? self.avatar : (user?.avatar ?? ''),
      text, time, isSelf
    };
  });
}

/** Trò chuyện 1-1 có sẵn với từng người bạn. */
export const FRIEND_SCRIPTS: Record<string, ScriptLine[]> = {
  db7: [
    ['db7', '08:15', 'Chào buổi sáng! 🌞 Hôm qua mình cày xong cả mùa vụ rồi nè'],
    ['me', '08:17', 'Trời, siêng quá! Mình mới thức dậy thôi 😂'],
    ['db7', '08:18', 'Hihi, mình trồng được 40 cây dâu tây luôn á 🍓🍓'],
    ['me', '08:20', 'Cho mình xin vài cây với!'],
    ['db7', '08:21', 'Ok luôn! Tối nay vào nông trại của mình nha, mình gửi lời mời liền 💜']
  ],
  db6: [
    ['db6', '21:02', 'Ê! Tối nay Dota không? Đang thiếu 1 slot 😤'],
    ['me', '21:03', 'Có chứ, mấy giờ vào?'],
    ['db6', '21:03', 'Giờ luôn! Lobby đang đợi, vào lẹ đi 🔥'],
    ['db6', '21:05', 'Trận trước cậu carry quá trời, lần này làm lại nha'],
    ['me', '21:06', 'Haha để mình chọn tướng đã 😎']
  ],
  db8: [
    ['db8', '19:40', 'Anh em ơi, có ai săn Rathalos chưa? 🐉'],
    ['me', '19:41', 'Mình mới có cái đuôi của nó thôi!'],
    ['db8', '19:41', 'Vậy là cậu đánh gục nó rồi còn gì 😆'],
    ['db8', '19:42', 'Đi hunt cùng không? Mình đang kẹt ở cái cánh']
  ]
};

/** Nhóm đã có sẵn: "Hội Anh Em Cày Game" (nhóm trưởng: rong_con_96). */
export const OWN_GROUP_SCRIPT: ScriptLine[] = [
  ['db8', '19:00', 'Chào cả nhà! Tối nay mình có kèo gì không nè? 🎮'],
  ['db6', '19:01', 'Dota 5 người, đang thiếu đúng 1 người thôi 😤'],
  ['db9', '19:01', 'Mình sợ ma nên chỉ chơi game có ánh sáng thôi nha 🔦'],
  ['db5', '19:02', 'Đang đọc cốt truyện Witcher, chưa muốn thoát ra 📖'],
  ['db7', '19:03', 'Mình nhường cả mùa dâu tây cho ai vào farm cùng nè 🍓'],
  ['db8', '19:03', 'Hahaha dâu tây thì bao nhiêu cũng nhận 😂'],
  ['db9', '19:04', 'Ê hôm qua mình chơi Phasmophobia, con ma nó gọi tên mình luôn á 😱'],
  ['db6', '19:04', 'Chắc tại cậu hét to quá nó nghe thấy 🤣🤣'],
  ['db5', '19:05', 'Cho mình hỏi: trong nhóm ai mua Black Myth chưa?'],
  ['db8', '19:06', 'Mình đang chờ sale, giá đó hơi đau ví 💸'],
  ['db7', '19:06', 'Canh mục Ưu đãi trên STEAL đi, hay có đợt giảm bất ngờ lắm!'],
  ['db9', '19:07', 'Chốt kèo: 21h lên Discord, ai trễ phải mời trà sữa 🧋'],
  ['db6', '19:07', 'Quá chuẩn! Mình đặt trước ly trân châu 😎'],
  ['db8', '19:08', 'Nhớ vào nhóm điểm danh nha mọi người ✋']
];

/** Lời mời nhóm 1: có nhiều người lạ để kết bạn. */
export const INVITE_CTRLC_SCRIPT: ScriptLine[] = [
  ['db1', '19:30', 'Chào cả nhà! Tối nay 20h lên Discord nha, mình kéo thêm người mới 🐱'],
  ['db12', '19:31', 'Hello mọi người! Mình là Trinh, nhóm này đông vui ghê ha 😍'],
  ['db13', '19:31', 'Mình đang stream thử nghiệm, ai rảnh vào xem cho đỡ buồn nha 🎥'],
  ['db3', '19:32', 'Anh Tùng stream game gì đó? Em vào cổ vũ liền!'],
  ['db4', '19:33', 'Có ai chơi CS2 không? Mình rank cao nhưng lười leo rank một mình 🔫'],
  ['db12', '19:33', 'Mình chơi dở lắm nhưng cổ vũ nhiệt tình nha 📣'],
  ['db1', '19:34', 'Yên tâm, nhóm mình vui là chính, thắng thua không quan trọng 😸'],
  ['db13', '19:35', 'Ai vào nhóm xong nhớ kết bạn với nhau cho dễ rủ nha!']
];

/** Lời mời nhóm 2. */
export const INVITE_BOSS_SCRIPT: ScriptLine[] = [
  ['db9', '22:10', 'Anh em ơi, đêm nay săn boss kinh dị, ai gan thì vào! 👻'],
  ['db14', '22:11', 'Mình vào kiểu xem thôi chứ gan bé tí 🙈'],
  ['db15', '22:11', 'Mình thích mấy game dễ thương hơn nhưng đi cùng cho vui 💜'],
  ['db6', '22:12', 'Đừng lo, có mình đi trước che chắn cho 😎'],
  ['db9', '22:13', 'Hứa là không bỏ ai lại phía sau (chắc vậy)... 🤣'],
  ['db14', '22:14', 'Nghe không đáng tin chút nào luôn á 😭']
];

/** Lời mời nhóm tự động khi người dùng mới có 2 người bạn đầu tiên. */
export const STARTER_GROUP_SCRIPT: ScriptLine[] = [
  ['db12', '20:00', 'Chào mừng người mới! Nhóm mình toàn người dễ thương 🥰'],
  ['db13', '20:01', 'Ai vào cũng được tặng một lượt follow miễn phí nha 😆'],
  ['db14', '20:02', 'Nhóm chat vui lắm, cứ tham gia thử đi!']
];

/* ===================== Phản hồi tự động ===================== */

export const PERSONALITY_REPLIES: Record<string, string[]> = {
  cute: ['Meo meo~ 🐱 rủ mình chơi gì đó đi!', 'Mình vừa nhặt được món đồ xịn luôn á ✨', 'Đợi mình xíu, đang cho mèo ăn 😸', 'Hihi, bạn dễ thương ghê 💕'],
  chill: ['Ok, thoải mái thôi bạn ơi ☕', 'Từ từ rồi tính, không vội 😌', 'Nghe hay đó, để mình thử xem', 'Chill thôi, game mà 🎧'],
  smart: ['Để mình tính lại chiến thuật rồi báo bạn nhé 🧠', 'Theo mình nghĩ thì nên thử cách khác xem', 'Ý hay đó! Mình ghi nhận 📝', 'Câu hỏi hay, để mình tra thêm rồi trả lời'],
  pro: ['Headshot! 🎯 ai thách đấu không?', 'Rank mình đang tụt, cần người kéo 😤', 'Vào trận đi, mình dẫn rush!', 'Tụi mình cần thêm một tay súng tốt'],
  calm: ['Ừm, mình thấy ổn đó 🙂', 'Để mình đọc xong chương này rồi nói tiếp nhé', 'Cảm ơn bạn đã nhắn, mình vui lắm', 'Mình online hơi muộn, thông cảm nha'],
  hype: ['VÀO LOBBY NGAY ĐI ANH EM 🔥🔥', 'Hôm nay mình có cảm giác sẽ thắng á!', 'Quá đỉnh luôn bạn ơi 😤', 'Gọi thêm người đi, càng đông càng vui!'],
  sweet: ['Hihi, bạn nhắn làm mình vui ghê 🍓', 'Mình mới chơi xong một ván dễ thương lắm 💜', 'Cuối tuần mình rủ nhau farm nha~', 'Bạn thích game màu tím không? Mình cực kỳ thích!'],
  funny: ['Hahaha bạn làm mình cười muốn đứt hơi 😂', 'Nghe xong cái là hết buồn luôn á', 'Mình đang ăn mì gói mà bạn nhắn cái là sặc 🍜', 'Chơi game xong là đói liền, kỳ ghê!'],
  meme: ['Ủa alo? 🤨', 'Hết tiền rồi nhưng vẫn mua game 😭', 'Cái này mình thấy trên mạng rồi nè, hài lắm', 'Đời là bể khổ, game là phao cứu sinh 🛟'],
  foodie: ['Bạn ăn gì chưa? Mình đang đói cồn cào 🍜', 'Vừa chơi vừa ăn là chân ái!', 'Mai mình bao trà sữa nếu thắng nha 🧋', 'Đợi mình lấy thêm đồ ăn, không bỏ lỡ ván nào!'],
  chatty: ['Ơ bạn ơi, mình kể cái này nghe nè... mà thôi để mình nhắn tiếp 😆', 'Hôm nay mình gặp chuyện vui lắm!', 'Mọi người đâu hết rồi nè? Trống vắng ghê 🥲', 'Bạn có biết gì chưa? Có game mới ra đó!'],
  host: ['Cảm ơn bạn đã ghé xem stream nha 🎥', 'Follow mình giúp một cái đi, mình sắp lên 20 người theo dõi rồi 😂', 'Tối nay mình stream từ 9h, ghé chơi nhé!', 'Chat vui quá, mình tăng độ khó luôn!']
};

export const KEYWORD_REPLIES: { pattern: RegExp; lines: string[] }[] = [
  { pattern: /(chào|hello|\bhi\b|alo|xin chào)/i, lines: ['Chào bạn hiền! 👋', 'Hello hello! Lâu quá không gặp 😄', 'Ơi, mình đây nè!'] },
  { pattern: /(chơi|rủ|team|party|cày|lobby)/i, lines: ['Okeee, mấy giờ vậy?', 'Tối nay mình rảnh, lên Discord luôn!', 'Đi đi đi! Để mình gọi thêm đồng đội 😆', 'Chốt kèo! Đợi mình 5 phút nha'] },
  { pattern: /(sale|giảm giá|ưu đãi|giá|khuyến mãi)/i, lines: ['Đúng lúc đang sale đó, vào mục Ưu đãi coi nhanh!', 'Mình canh sale game này lâu rồi, mua quà tặng mình nha 😝', 'Giá đó hời thật sự, mua đi!'] },
  { pattern: /(wishlist|danh sách ước|hồ sơ|profile)/i, lines: ['Ghé hồ sơ mình xem danh sách ước nè, tặng cái nào cũng được 😂', 'Danh sách ước của mình dài như sớ táo quân luôn 📜'] },
  { pattern: /(cảm ơn|thanks|thank|cám ơn)/i, lines: ['Có gì đâu mà cảm ơn! 😊', 'Bạn bè mà, khách sáo làm gì 💜'] },
  { pattern: /(buồn|mệt|chán)/i, lines: ['Cố lên bạn ơi! Chơi một ván cho vui nào 💪', 'Mệt thì nghỉ chút, có mình ở đây rồi 🫶'] },
  { pattern: /(haha|hihi|:\)|😂|🤣)/i, lines: ['Hahaha đúng không! 😂', 'Cười muốn xỉu luôn á 🤣'] }
];

export const GROUP_BANTER: string[] = [
  'Hahaha đúng rồi nè 😂', 'Nghe có lý đó nha!', 'Cho mình tham gia với!', 'Ôi trời, đỉnh quá 🔥',
  'Đợi mình xíu, mình quay lại liền', 'Ai rảnh tối nay lên Discord nè ✋', 'Quá chuẩn luôn bạn ơi 👍', 'Mình vote đồng ý! 🙌'
];
