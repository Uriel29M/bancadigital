(function loadDcComicsBlackLabelCatalog() {
  const imprint = "Black Label";
  const publisher = "DC Comics";
  const cover = {
    damned: "https://static.dc.com/dc/files/default_images/BMDAM_01_300-001_HD_5b919b66648829.90302280.jpg",
    whiteKnight: "https://static.dc.com/dc/files/default_images/BMWK_234-001_HD_5baa7b54acdb18.56871942.jpg",
    lastKnight: "https://static.dc.com/dc/files/default_images/BM_LKOE_gallery_5cdc6276f15755.97888428.jpg",
    threeJokers: "https://static.dc.com/dc/files/default_images/cover-v2_5f40314645a734.37285065.png",
    killerSmile: "https://static.dc.com/dc/files/default_images/JKRKLSM_01_300-001_HD_5da6688ac81db1.97481384.jpg?w=2000",
    harleen: "https://static.dc.com/dc/files/default_images/HARLEEN_01_300-001_HD_5d7a9ef10c6ee4.87167074.jpg",
    question: "https://static.dc.com/dc/files/default_images/The_Question%2520Cv1%2520mockup_5dc5f49d26cd53.75820306.jpg",
    dangerStreet: "https://static.dc.com/dc/files/default_images/DangerSt_Cv1_00111_6324b07e2507b7.87619189.jpg",
    supermanYearOne: "https://static.dc.com/dc/files/default_images/SMYEAR1_01_300-001_HD_5cf5bfd63390a1.95789933.jpg"
  };

  // Links autorizados fornecidos para a distribuição dos arquivos.
  const fileLinks = {
    "series-batman-damned-2018": [
      "https://www.mediafire.com/file/grgw31n1r9pn39v/Batman_Damned_01.cbr/file",
      "https://www.mediafire.com/file/u0s4i8auffjaujr/Batman_Damned_02.cbr/file",
      "https://www.mediafire.com/file/u1321smdwoe8osh/Batman_Damned_03.cbr/file"
    ],
    "series-batman-white-knight-2017": [
      "https://www.mediafire.com/file/6o4ael8l94crjvp/Batman_Cavaleiro_Branco_01.cbr/file",
      "https://www.mediafire.com/file/bhkemzxbb7kdzz6/Batman_Cavaleiro_Branco_02.cbr/file",
      "https://www.mediafire.com/file/f49pfeif00wserg/Batman_Cavaleiro_Branco_03.cbr/file",
      "https://www.mediafire.com/file/fn7qnv2xhzbj64i/Batman_Cavaleiro_Branco_04.cbr/file",
      "https://www.mediafire.com/file/gvaygsvctqy2ltp/Batman_Cavaleiro_Branco_05.cbr/file",
      "https://www.mediafire.com/file/k5ezc3xujw1v57p/Batman_Cavaleiro_Branco_06.cbr/file",
      "https://www.mediafire.com/file/k73uxqhx0qfjsa2/Batman_Cavaleiro_Branco_07.cbr/file",
      "https://www.mediafire.com/file/swq65vyscpgqhjt/Batman_Cavaleiro_Branco_08.cbr/file"
    ],
    "series-batman-last-knight-on-earth-2019": [
      "https://www.mediafire.com/file/nfhuyni97nmrngm/Batman_Ultimo_Cavaleiro_da_Terra_01.cbr/file",
      "https://www.mediafire.com/file/pm26t5plrgjdc19/Batman_Ultimo_Cavaleiro_da_Terra_02.cbr/file",
      "https://www.mediafire.com/file/ug7ubn6fu73tpg7/Batman_Ultimo_Cavaleiro_da_Terra_03.cbr/file"
    ],
    "series-batman-three-jokers-2020": [
      "https://www.mediafire.com/file/3aqzy6kjg6ano6a/Batman_Tres_Coringas_01.cbr/file",
      "https://www.mediafire.com/file/tvyev42lbk2esb9/Batman_Tres_Coringas_02.cbr/file",
      "https://www.mediafire.com/file/4ri9qlzhws6kyma/Batman_Tres_Coringas_03.cbr/file"
    ],
    "series-joker-killer-smile-2019": ["https://www.mediafire.com/file/e200qi2qiw7t7a3/Coringa_Sorriso_Assassino_01.cbr/file"],
    "series-harleen-2019": [
      "https://www.mediafire.com/file/rq6ipyh0zd662gk/Harleen_01.cbr/file",
      "https://www.mediafire.com/file/5wr9bom8yasqu31/Harleen_02.cbr/file",
      "https://www.mediafire.com/file/w81v8l93q3s2t63/Harleen_03.cbr/file"
    ],
    "series-question-deaths-vic-sage-2019": [
      "https://www.mediafire.com/file/hj99bmeigx2vezm/O_Questao_01.cbr/file",
      "https://www.mediafire.com/file/h592zilvam2nvao/O_Questao_02.cbr/file",
      "https://www.mediafire.com/file/gsypltrkbll3hj9/O_Questao_03.cbr/file",
      "https://www.mediafire.com/file/8gcrav257zkgfv1/O_Questao_04.cbr/file"
    ],
    "series-danger-street-2023": [
      "https://www.mediafire.com/file/tws352k86t2d209/Rua_Perigo_01.cbr/file",
      "https://www.mediafire.com/file/mj9mrgmze671qkz/Rua_Perigo_02.cbr/file",
      "https://www.mediafire.com/file/hqbgawl17ytc1ns/Rua_Perigo_03.cbr/file",
      "https://www.mediafire.com/file/32skvfz3yzconbq/Rua_Perigo_04.cbr/file"
    ],
    "series-superman-year-one-2019": [
      "https://www.mediafire.com/file/ifu9uta5ze8znvw/Superman_Ano_Um_01.cbr/file",
      "https://www.mediafire.com/file/mz0fyw8indx2u78/Superman_Ano_Um_02.cbr/file",
      "https://www.mediafire.com/file/ism0y0v7f5rzl30/Superman_Ano_Um_03.cbr/file"
    ]
  };
  Object.keys(fileLinks).forEach(key => {
    fileLinks[key] = fileLinks[key].map(url => url.replace(/\/[^/]+\/file$/, ""));
  });

  const series = [
    ["series-batman-damned-2018", "Batman: Amaldiçoado", "Batman: Damned", 3, 2018, "Brian Azzarello / Lee Bermejo", "Batman / John Constantine", "O Coringa está morto, mas Batman não se lembra do que aconteceu. Ao lado de John Constantine, ele atravessa uma investigação sobrenatural pelas regiões mais sombrias de Gotham.", cover.damned, "https://www.dc.com/comics/batman-damned-2018/batman-damned-1"],
    ["series-batman-white-knight-2017", "Batman: Cavaleiro Branco", "Batman: White Knight", 8, 2017, "Sean Murphy", "Batman / Coringa", "Depois de ser curado, o Coringa tenta salvar Gotham e fazer justiça enquanto Batman passa a ser visto como a maior ameaça da cidade.", cover.whiteKnight, "https://www.dc.com/graphic-novels/batman-white-knight-2017/batman-white-knight"],
    ["series-batman-last-knight-on-earth-2019", "Batman: O Último Cavaleiro da Terra", "Batman: Last Knight on Earth", 3, 2019, "Scott Snyder / Greg Capullo / Jonathan Glapion", "Batman", "Bruce Wayne desperta no Asilo Arkham sem se lembrar de ter sido Batman e parte por uma paisagem devastada em busca das respostas sobre seu passado.", cover.lastKnight, "https://www.dc.com/comics/batman-last-knight-on-earth-2019/batman-last-knight-on-earth-1"],
    ["series-batman-three-jokers-2020", "Batman: Três Coringas", "Batman: Three Jokers", 3, 2020, "Geoff Johns / Jason Fabok", "Batman / Coringa / Batgirl / Capuz Vermelho", "Trinta anos depois de A Piada Mortal, Batman, Batgirl e Capuz Vermelho investigam a existência de três Coringas e o centro de sua eterna batalha.", cover.threeJokers, "https://www.dc.com/comics/batman-three-jokers-2020/batman-three-jokers-1"],
    ["series-joker-killer-smile-2019", "Coringa: Sorriso Assassino", "Joker: Killer Smile", 1, 2019, "Jeff Lemire / Andrea Sorrentino", "Coringa / Dr. Ben Arnell", "O psiquiatra Ben Arnell tenta compreender a mente do Coringa, mas descobre que seus próprios olhos e sua sanidade não são confiáveis.", cover.killerSmile, "https://www.dc.com/comics/joker-killer-smile-2019/joker-killer-smile-1"],
    ["series-harleen-2019", "Harleen", "Harleen", 3, 2019, "Stjepan Šejić", "Harleen Quinzel / Coringa", "A jovem psiquiatra Harleen Quinzel procura uma cura para a loucura de Gotham e acaba testemunhando o nascimento da lendária Arlequina.", cover.harleen, "https://www.dc.com/comics/harleen-2019/harleen-1"],
    ["series-question-deaths-vic-sage-2019", "O Questão: As Mortes de Vic Sage", "The Question: The Deaths of Vic Sage", 4, 2019, "Jeff Lemire / Denys Cowan / Bill Sienkiewicz", "O Questão", "Vic Sage é atraído para uma conspiração que vai das alturas do poder de Hub City às profundezas de seus túneis subterrâneos.", cover.question, "https://www.dc.com/comics/the-question-the-deaths-of-vic-sage-2019/the-question-the-deaths-of-vic-sage-1"],
    ["series-danger-street-2023", "Rua Perigo", "Danger Street", 4, 2023, "Tom King / Jorge Fornés", "Starman / Metamorfo / Guerreiro / Darkseid", "Starman, Metamorfo e Guerreiro tentam provar que merecem entrar para a Liga da Justiça e descobrem que invocar um Novo Deus nunca termina bem.", cover.dangerStreet, "https://www.dc.com/comics/danger-street-2022/danger-street-1"],
    ["series-superman-year-one-2019", "Superman: Ano Um", "Superman: Year One", 3, 2019, "Frank Miller / John Romita Jr. / Danny Miki / Alex Sinclair", "Superman / Clark Kent", "Do nascimento em Krypton à vida no Kansas e à entrada na Marinha, esta minissérie reimagina a juventude e a origem de Clark Kent.", cover.supermanYearOne, "https://www.dc.com/comics/superman-year-one-1"]
  ];

  window.DEFAULT_SERIES = window.DEFAULT_SERIES || [];
  window.DEFAULT_LIBRARY = window.DEFAULT_LIBRARY || [];
  series.forEach(([id, name, originalTitle, count, year, author, character, description, coverUrl, officialUrl]) => {
    window.DEFAULT_SERIES.push({ id, name, seriesTitle: name, originalTitle, type: "comic", publisher, imprint, publication: "Minissérie", status: "Cancelada/Terminada", editions: String(count).padStart(2, "0"), year, description, coverUrl, telegramUrl: "", author, character, tags: [name, originalTitle, character, "DC Comics", "Black Label"], officialUrl });
    for (let n = 1; n <= count; n += 1) {
      const issueOfficialUrl = n === 1 || !officialUrl.includes("-1") ? officialUrl : officialUrl.replace(/-1(?=$|\/)/, `-${n}`);
      const fileUrl = fileLinks[id]?.[n - 1] || "";
      window.DEFAULT_LIBRARY.push({ id: `${id}-${String(n).padStart(3, "0")}`, seriesId: id, title: name, issue: String(n), year, format: "cbr", fileUrl, coverUrl: n === 1 ? coverUrl : null, officialUrl: issueOfficialUrl, clicks: 0, featured: true, randomWeight: 5, collectionIds: [] });
    }
  });

  const dangerStreetIssues = {
    1: { fileUrl: "https://www.mediafire.com/file/tws352k86t2d209/Rua+Perigo+-+01+(2023)+(Gibiscuits).cbr/file", coverUrl: "https://i.imgur.com/nXnoN20.jpg" },
    2: { fileUrl: "https://www.mediafire.com/file/mj9mrgmze671qkz/Rua+Perigo+-+02+(2023)+(Gibiscuits).cbr/file", coverUrl: "https://i.imgur.com/sozWfyk.jpg" },
    3: { fileUrl: "https://www.mediafire.com/file/hqbgawl17ytc1ns/Rua+Perigo+-+03+(2023)+(Gibiscuits).cbr/file", coverUrl: "https://i.imgur.com/9kRgVg0.jpg" },
    4: { fileUrl: "https://www.mediafire.com/file/32skvfz3yzconbq/Rua+Perigo+-+04+(2023)+(Gibiscuits).cbr/file", coverUrl: "https://i.ibb.co/mvNN3kX/rp-04-pag-00.jpg" }
  };
  window.DEFAULT_LIBRARY.filter(item => item.seriesId === "series-danger-street-2023").forEach(item => {
    const issue = dangerStreetIssues[Number(item.issue)];
    if (issue) Object.assign(item, issue);
  });
  const supermanYearOneCovers = {
    1: "https://static.dc.com/dc/files/default_images/SMYEAR1_01_300-001_HD_5cf5bfd63390a1.95789933.jpg",
    2: "https://i.imgur.com/HK6Cex1.jpg",
    3: "https://i.imgur.com/gxRthQS.jpg"
  };
  window.DEFAULT_LIBRARY.filter(item => item.seriesId === "series-superman-year-one-2019").forEach(item => {
    const coverUrl = supermanYearOneCovers[Number(item.issue)];
    if (coverUrl) item.coverUrl = coverUrl;
  });
  const questionCovers = {
    1: "https://static.dc.com/dc/files/default_images/The_Question%2520Cv1%2520mockup_5dc5f49d26cd53.75820306.jpg",
    2: "https://i.postimg.cc/MZcypQWc/The-Question-The-Deaths-of-Vic-Sage-002-000.jpg",
    3: "https://comicvine.gamespot.com/a/uploads/scale_small/6/67663/7423192-03.jpg",
    4: "https://comicvine.gamespot.com/a/uploads/scale_small/6/67663/7537619-04.jpg"
  };
  window.DEFAULT_LIBRARY.filter(item => item.seriesId === "series-question-deaths-vic-sage-2019").forEach(item => {
    const coverUrl = questionCovers[Number(item.issue)];
    if (coverUrl) item.coverUrl = coverUrl;
  });
  const harleenCovers = {
    1: "https://static.dc.com/dc/files/default_images/HARLEEN_01_300-001_HD_5d7a9ef10c6ee4.87167074.jpg",
    2: "https://i.imgur.com/OP5dO2y.jpg",
    3: "https://zonafantasmanet.files.wordpress.com/2020/05/harleen-003-000.jpg"
  };
  window.DEFAULT_LIBRARY.filter(item => item.seriesId === "series-harleen-2019").forEach(item => {
    const coverUrl = harleenCovers[Number(item.issue)];
    if (coverUrl) item.coverUrl = coverUrl;
  });
  const lastKnightCovers = {
    1: "https://static.dc.com/dc/files/default_images/BM_LKOE_Cv1_1500_5cdc620e979443.57980730.jpg",
    2: "https://static.dc.com/dc/files/default_images/BMLKOE_02_300-001_HD_5d30c699be08d1.04812888.jpg",
    3: "https://static.dc.com/dc/files/default_images/BMLKOE_03_300-001_HD_5de80ed55c4d03.65692384.jpg"
  };
  window.DEFAULT_LIBRARY.filter(item => item.seriesId === "series-batman-last-knight-on-earth-2019").forEach(item => {
    const coverUrl = lastKnightCovers[Number(item.issue)];
    if (coverUrl) item.coverUrl = coverUrl;
  });
  const whiteKnightCovers = {
    1: "https://static.dc.com/dc/files/default_images/BMJKWK_01_300-001_HD_5b7f187f0c3930.50204153.jpg",
    2: "https://static.dc.com/dc/files/default_images/BMJKWK_02_300-001_HD_5b7f18a7625a75.62460877.jpg",
    3: "https://static.dc.com/dc/files/default_images/BMJKWK_03_300-001_HD_5b7f18cff0cac2.36689143.jpg",
    4: "https://static.dc.com/dc/files/default_images/BMJKWK_04_300-001_HD_5b7f18e7b6db45.20677615.jpg",
    5: "https://static.dc.com/dc/files/default_images/BMJKWK_05_300-001_HD_5b7f18fecd1231.46993964.jpg",
    6: "https://static.dc.com/dc/files/default_images/BMJKWK_06_300-001_HD_5b7f1923888082.83707236.jpg",
    7: "https://static.dc.com/dc/files/default_images/BMJKWK_07_300-001_HD_5b7f193910be12.79651873.jpg",
    8: "https://static.dc.com/dc/files/default_images/BMJKWK_08_300-001_HD_5b7f1950a58ba6.64160051.jpg"
  };
  window.DEFAULT_LIBRARY.filter(item => item.seriesId === "series-batman-white-knight-2017").forEach(item => {
    const coverUrl = whiteKnightCovers[Number(item.issue)];
    if (coverUrl) item.coverUrl = coverUrl;
  });
  const damnedCovers = {
    1: "https://static.dc.com/dc/files/default_images/BMDAM_01_300-001_HD_5b919b66648829.90302280.jpg",
    2: "https://static.dc.com/dc/files/default_images/BMDAM_02_300-001_HD_5bfd8fa8e5da39.56304651.jpg",
    3: "https://static.dc.com/dc/files/default_images/BMDAM_03_300-001_HD_5d014b3c297ee5.56572348.jpg"
  };
  window.DEFAULT_LIBRARY.filter(item => item.seriesId === "series-batman-damned-2018").forEach(item => {
    const coverUrl = damnedCovers[Number(item.issue)];
    if (coverUrl) item.coverUrl = coverUrl;
  });
  const threeJokersCovers = {
    1: "https://static.dc.com/dc/files/default_images/cover-v2_5f40314645a734.37285065.png",
    2: "https://static.dc.com/dc/files/default_images/BTJ_02_300-001_HD_5f5ff19bd0e251.86173396.jpg",
    3: "https://static.dc.com/dc/files/default_images/BTJ_Cv3_CMYK_PMS802_5f88921e3551f0.82519983.jpg"
  };
  window.DEFAULT_LIBRARY.filter(item => item.seriesId === "series-batman-three-jokers-2020").forEach(item => {
    const coverUrl = threeJokersCovers[Number(item.issue)];
    if (coverUrl) item.coverUrl = coverUrl;
  });
})();
