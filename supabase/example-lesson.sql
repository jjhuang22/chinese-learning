-- Supabase SQL Editor: replace the UUID placeholder below.
-- Find it under Authentication > Users > your account > User UID.
-- This newly written example is safe to keep in the public repository.
-- A duplicate date raises an error; existing lessons are never overwritten.
do $import$
declare
  learner_id uuid := 'YOUR_SUPABASE_USER_UUID'::uuid;
  lesson jsonb := $lesson${
  "date": "2026-10-22",
  "title": "買得划算，真的用得上嗎？",
  "passages": [
    {
      "title": "一起湊單，還是各買各的？",
      "format": "Dialogue",
      "sentences": [
        {
          "text": "甲：這家店今天滿一千元就免運，你要不要一起湊單？",
          "pinyin": "Jiǎ: Zhè jiā diàn jīntiān mǎn yì qiān yuán jiù miǎn yùn, nǐ yào bu yào yìqǐ còu dān?",
          "paragraph": 0
        },
        {
          "text": "乙：我原本只想買一包茶，現在卻在想要不要多買幾樣，才不會浪費折扣。",
          "pinyin": "Yǐ: Wǒ yuánběn zhǐ xiǎng mǎi yì bāo chá, xiànzài què zài xiǎng yào bu yào duō mǎi jǐ yàng, cái bú huì làngfèi zhékòu.",
          "paragraph": 1
        },
        {
          "text": "甲：可是，為了省運費而買用不上的東西，不一定比較划算。",
          "pinyin": "Jiǎ: Kěshì, wèile shěng yùnfèi ér mǎi yòng bu shàng de dōngxi, bù yídìng bǐjiào huásuàn.",
          "paragraph": 2
        },
        {
          "text": "乙：也是。我上次一時衝動囤了不少咖啡，結果到現在還沒喝完。",
          "pinyin": "Yǐ: Yě shì. Wǒ shàng cì yìshí chōngdòng tún le bù shǎo kāfēi, jiéguǒ dào xiànzài hái méi hē wán.",
          "paragraph": 3
        },
        {
          "text": "甲：與其勉強湊到免運，不如先算算自己真正需要多少。",
          "pinyin": "Jiǎ: Yǔqí miǎnqiǎng còu dào miǎn yùn, bùrú xiān suànsuan zìjǐ zhēnzhèng xūyào duōshǎo.",
          "paragraph": 4
        },
        {
          "text": "乙：那我先把購物車放著，明天還覺得需要，再下單。",
          "pinyin": "Yǐ: Nà wǒ xiān bǎ gòuwùchē fàngzhe, míngtiān hái juéde xūyào, zài xià dān.",
          "paragraph": 5
        }
      ]
    },
    {
      "title": "優惠以外的選擇",
      "format": "Reflection",
      "sentences": [
        {
          "text": "以前看到限時優惠，我總覺得錯過就可惜，常常還沒想清楚，就先把東西買回家。",
          "pinyin": "Yǐqián kàndào xiànshí yōuhuì, wǒ zǒng juéde cuòguò jiù kěxí, chángcháng hái méi xiǎng qīngchǔ, jiù xiān bǎ dōngxi mǎi huí jiā.",
          "paragraph": 0
        },
        {
          "text": "有些用品確實派上用場，更多的卻只是放在櫃子裡，提醒我曾經多麼相信自己會開始新的習慣。",
          "pinyin": "Yǒu xiē yòngpǐn quèshí pài shàng yòngchǎng, gèng duō de què zhǐshì fàng zài guìzi lǐ, tíxǐng wǒ céngjīng duōme xiāngxìn zìjǐ huì kāishǐ xīn de xíguàn.",
          "paragraph": 0
        },
        {
          "text": "後來我才發現，買得便宜，並不代表這筆錢花得值得。",
          "pinyin": "Hòulái wǒ cái fāxiàn, mǎi de piányí, bìng bù dàibiǎo zhè bǐ qián huā de zhíde.",
          "paragraph": 1
        },
        {
          "text": "如果一件東西原本就不需要，折扣再大，也只是讓我用比較少的錢，買下一個不需要的選擇。",
          "pinyin": "Rúguǒ yí jiàn dōngxi yuánběn jiù bù xūyào, zhékòu zài dà, yě zhǐshì ràng wǒ yòng bǐjiào shǎo de qián, mǎi xià yí ge bù xūyào de xuǎnzé.",
          "paragraph": 1
        },
        {
          "text": "現在下單前，我會先問自己：如果沒有優惠，我還會想買嗎？",
          "pinyin": "Xiànzài xià dān qián, wǒ huì xiān wèn zìjǐ: Rúguǒ méi yǒu yōuhuì, wǒ hái huì xiǎng mǎi ma?",
          "paragraph": 2
        },
        {
          "text": "這不是要完全放棄享受，而是練習取捨，讓留下來的東西真的適合自己的生活。",
          "pinyin": "Zhè bú shì yào wánquán fàngqì xiǎngshòu, ér shì liànxí qǔshě, ràng liú xiàlái de dōngxi zhēn de shìhé zìjǐ de shēnghuó.",
          "paragraph": 2
        }
      ]
    }
  ],
  "suggestions": [
    {
      "text": "湊單",
      "pinyin": "còu dān",
      "meaning": "Combine purchases to reach a minimum order or shipping threshold.",
      "sentence": "甲：這家店今天滿一千元就免運，你要不要一起湊單？",
      "kind": "vocabulary",
      "id": "import-2026-10-22-0"
    },
    {
      "text": "折扣",
      "pinyin": "zhékòu",
      "meaning": "A discount; a reduction from the usual price.",
      "sentence": "乙：我原本只想買一包茶，現在卻在想要不要多買幾樣，才不會浪費折扣。",
      "kind": "vocabulary",
      "id": "import-2026-10-22-1"
    },
    {
      "text": "用不上",
      "pinyin": "yòng bu shàng",
      "meaning": "Have no use for something; not have an occasion to use it.",
      "sentence": "甲：可是，為了省運費而買用不上的東西，不一定比較划算。",
      "kind": "vocabulary",
      "id": "import-2026-10-22-2"
    },
    {
      "text": "划算",
      "pinyin": "huásuàn",
      "meaning": "Worthwhile or good value when costs and benefits are considered.",
      "sentence": "甲：可是，為了省運費而買用不上的東西，不一定比較划算。",
      "kind": "vocabulary",
      "id": "import-2026-10-22-3"
    },
    {
      "text": "一時衝動",
      "pinyin": "yìshí chōngdòng",
      "meaning": "A momentary impulse; acting on a passing urge.",
      "sentence": "乙：也是。我上次一時衝動囤了不少咖啡，結果到現在還沒喝完。",
      "kind": "vocabulary",
      "id": "import-2026-10-22-4"
    },
    {
      "text": "囤",
      "pinyin": "tún",
      "meaning": "Stockpile or buy extra to store for later use.",
      "sentence": "乙：也是。我上次一時衝動囤了不少咖啡，結果到現在還沒喝完。",
      "kind": "vocabulary",
      "id": "import-2026-10-22-5"
    },
    {
      "text": "派上用場",
      "pinyin": "pài shàng yòngchǎng",
      "meaning": "Come in handy; find a practical use.",
      "sentence": "有些用品確實派上用場，更多的卻只是放在櫃子裡，提醒我曾經多麼相信自己會開始新的習慣。",
      "kind": "vocabulary",
      "id": "import-2026-10-22-6"
    },
    {
      "text": "取捨",
      "pinyin": "qǔshě",
      "meaning": "Decide what to keep and what to give up; make tradeoffs.",
      "sentence": "這不是要完全放棄享受，而是練習取捨，讓留下來的東西真的適合自己的生活。",
      "kind": "vocabulary",
      "id": "import-2026-10-22-7"
    },
    {
      "text": "與其……不如……",
      "pinyin": "yǔqí…bùrú…",
      "meaning": "Present one course as less worthwhile and recommend another.",
      "sentence": "甲：與其勉強湊到免運，不如先算算自己真正需要多少。",
      "kind": "grammar",
      "id": "import-2026-10-22-8"
    },
    {
      "text": "再……也……",
      "pinyin": "zài…yě…",
      "meaning": "Even however much: the degree does not change the conclusion.",
      "sentence": "如果一件東西原本就不需要，折扣再大，也只是讓我用比較少的錢，買下一個不需要的選擇。",
      "kind": "grammar",
      "id": "import-2026-10-22-9"
    }
  ],
  "notes": [
    {
      "title": "折扣再大，也……",
      "text": "再＋adjective＋也 introduces an extreme that still does not change the conclusion. In 折扣再大，也只是……, even a very large discount does not make an unnecessary purchase necessary. Compare: 折扣很大，所以我買了。 (The discount was large, so I bought it.)\n折扣再大，我也不買。\nZhékòu zài dà, wǒ yě bù mǎi.\nNo matter how large the discount, I still will not buy it."
    }
  ],
  "id": "import-2026-10-22",
  "subtitle": ""
}$lesson$::jsonb;
begin
  if not exists (select 1 from auth.users where id = learner_id) then
    raise exception 'No user exists with that UUID. Create your account first.';
  end if;
  insert into public.lessons (user_id, lesson_date, content)
    values (learner_id, (lesson->>'date')::date, lesson);
end;
$import$;
