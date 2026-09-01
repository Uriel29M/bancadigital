(function () {
  const publisher = "DC Comics";
  const imprint = "Milestone";
  const sources = {
    guerra: "https://hqs-soquadrinhos.blogspot.com/2023/03/guerra-das-sombras-1994.html",
    hardware: "https://hqs-soquadrinhos.blogspot.com/2022/12/hardware-v1-1993.html",
    icone: "https://hqs-soquadrinhos.blogspot.com/2023/01/blog-post.html",
    sindicato: "https://hqs-soquadrinhos.blogspot.com/2022/11/sindicato-de-sangue-1993.html",
    static: "https://hqs-soquadrinhos.blogspot.com/2022/11/super-choque.html"
  };
  const guerraCovers = [
    "https://i.imgur.com/CE6bwCn.jpg", "https://i.postimg.cc/7b806Ssm/cone-09-1994-SQ-Gibiscuits-Ba-ZF-0.jpg", "https://i.ibb.co/18hSxrN/Xombi0-0.jpg",
    "https://i.ibb.co/hR6Q03n/00.jpg", "https://i.postimg.cc/44P1W2x8/Superchoque8-001.jpg", "https://i.postimg.cc/J4Xc8NZZ/GdS0-001.jpg"
  ];
  const hardwareCovers = [
    "https://www.coverbrowser.com/image/hardware/1-1.jpg", "https://www.coverbrowser.com/image/hardware/2-1.jpg", "https://www.coverbrowser.com/image/hardware/3-1.jpg", "https://www.coverbrowser.com/image/hardware/4-1.jpg",
    "https://www.coverbrowser.com/image/hardware/5-1.jpg", "https://www.coverbrowser.com/image/hardware/6-1.jpg", "https://www.coverbrowser.com/image/hardware/7-1.jpg", "https://www.coverbrowser.com/image/hardware/8-1.jpg",
    "https://www.coverbrowser.com/image/hardware/9-1.jpg", "https://www.coverbrowser.com/image/hardware/10-1.jpg", "https://www.coverbrowser.com/image/hardware/11-1.jpg", "https://www.coverbrowser.com/image/hardware/12-1.jpg",
    "https://www.coverbrowser.com/image/hardware/13-1.jpg", "https://www.coverbrowser.com/image/hardware/14-1.jpg", "https://www.coverbrowser.com/image/hardware/15-1.jpg", "https://www.coverbrowser.com/image/hardware/16-1.jpg"
  ];
  const iconeCovers = [
    "https://www.coverbrowser.com/image/icon/1-1.jpg", "https://www.coverbrowser.com/image/icon/2-1.jpg", "https://www.coverbrowser.com/image/icon/3-1.jpg", "https://www.coverbrowser.com/image/icon/4-1.jpg",
    "https://www.coverbrowser.com/image/icon/5-1.jpg", "https://www.coverbrowser.com/image/icon/6-1.jpg", "https://www.coverbrowser.com/image/icon/7-1.jpg", "https://www.coverbrowser.com/image/icon/8-1.jpg",
    "https://www.coverbrowser.com/image/icon/9-1.jpg", "https://www.coverbrowser.com/image/icon/10-1.jpg", "https://www.coverbrowser.com/image/icon/11-1.jpg", "https://www.coverbrowser.com/image/icon/12-1.jpg",
    "https://www.coverbrowser.com/image/icon/13-1.jpg", "https://www.coverbrowser.com/image/icon/14-1.jpg", "https://www.coverbrowser.com/image/icon/15-1.jpg", "https://www.coverbrowser.com/image/icon/16-1.jpg",
    "https://www.coverbrowser.com/image/icon/18-1.jpg", "https://www.coverbrowser.com/image/icon/19-1.jpg", "https://www.coverbrowser.com/image/icon/20-1.jpg", "https://www.coverbrowser.com/image/icon/21-1.jpg",
    "https://www.coverbrowser.com/image/icon/22-1.jpg", "https://www.coverbrowser.com/image/icon/23-1.jpg", "https://www.coverbrowser.com/image/icon/24-1.jpg", "https://www.coverbrowser.com/image/icon/25-1.jpg",
    "https://www.coverbrowser.com/image/icon/26-1.jpg", "https://www.coverbrowser.com/image/icon/27-1.jpg", "https://www.coverbrowser.com/image/icon/28-1.jpg", "https://www.coverbrowser.com/image/icon/29-1.jpg"
  ];
  const sindicatoCovers = [
    "https://i.imgur.com/MhNOWiE.jpg",
    "https://i.postimg.cc/MKny9Fnw/1-Capa-lan-amento.jpg",
    "https://i.postimg.cc/s2hCcgXM/Sem-T-tulo-1.jpg",
    "https://i.postimg.cc/6pN4cF4C/Blood-Syndicate-004-000.jpg",
    "https://i.ibb.co/Qd7Yfdq/Blood-Syndicate-005-000.jpg",
    "https://i.ibb.co/rxb8tcx/00.jpg",
    "https://i.ibb.co/2kdYnMz/7.jpg",
    "https://i.ibb.co/3fTKVnf/Blood-Syndicate-008-000.jpg",
    "https://i.ibb.co/0q89c3T/Blood-Syndicate-009-000.jpg",
    "https://i.ibb.co/hR6Q03n/00.jpg"
  ];
  const superchoqueCovers = [
    "https://i.imgur.com/7HOYodR.jpg", "https://i.postimg.cc/6p1RY8B7/Static-002-000.jpg", "https://i.postimg.cc/KvPwDLWM/Static-003-000.jpg", "https://i.postimg.cc/MpTVkHT0/Static-004-000.jpg",
    "https://i.postimg.cc/4yBK2kxw/Static-005-000.jpg", "https://i.imgur.com/slkSX9J.jpg", "https://i.imgur.com/fz9FB3X.jpg", "https://i.postimg.cc/44P1W2x8/Superchoque8-001.jpg",
    "https://i.postimg.cc/Y0kbbC12/01.jpg", "https://i.postimg.cc/TYLQZHCX/01.jpg", "https://i.postimg.cc/dQhvFXv2/01.jpg", "https://i.postimg.cc/DZy57Rqy/image.jpg",
    "https://i.postimg.cc/3R5pX5Yj/01.jpg", "https://i.postimg.cc/wvgcVFvW/Static-014-000.jpg", "https://i.postimg.cc/hGgdWvqH/01.jpg", "https://i.ibb.co/rfcLvWw9/01.jpg",
    "https://i.postimg.cc/T1f52LxM/01.jpg", "https://i.postimg.cc/Hn7VYjDF/image.jpg", "https://i.ibb.co/pB39zHMq/01.jpg", "https://i.ibb.co/5Wq2mcgW/01.jpg",
    "https://i.postimg.cc/d1RCQ15d/01.jpg", "https://i.postimg.cc/8c4b6DgD/01.jpg", "https://i.postimg.cc/N0Zmhsn4/00.jpg", "https://i.postimg.cc/vm0Qx27N/01.jpg"
  ];
  const issueNumbers = { icone: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29] };
  const ids = {
    guerra: "anlkv56579gle8w,cyolvd2b02riu4b,njbhrbydi5bmpri,mn8kv1fv3v30mfd,5jeshrlusvpl1qr,5bizvwrntca8hgs",
    hardware: "3rcs3z7owxfxykc,0fptwvlfrulmvl5,wqcf1eef4vg2irb,a8hf6c60d8gjgtq,qdqp2571tfeit10,p3rkc2v1710miah,ulgbqm65a5rw99x,j36i201b2bhd0co,80zz080fvjlsovj,wcesgt3jw54ilnw,anlkv56579gle8w,4t5ftn6z4f37ocd,ny7u06a0al2v4to,erefsc7hb92lzut,xv9j5y0w4sevq8o,7d2fst8ubpx463r",
    icone: "irpl9aq3e7cd05w,j0zvg8b9fvqtfbr,31jer5nwrwtgqr,b4ix55qglrof676,tudrp221m8y3yyu,lotw9zb2z0esfz7,4u6ddx3jyfq8gou,6ah5hig7zoy01sl,cyolvd2b02riu4b,1dtv0jdycswhvqj,is7fdg9j8man5q6,b8araabx7e4g7h9,https://www.mediafire.com/file_premium/75aatdrkdfmzxe8,j4kk2w6zkutduqu,igf0zbev6xubdd2,mw02xy4yotjlmes,nyc2ghm1uoj3prl,w60lk6r7hicyq96,lqpldr9dku3t6w6,nqu30l8lf3ncs32,3s2iaqj5563i5zr,v1wuvolicts5efk,ub4xd23snb2zxl1,49k3obtwhwx91zv,ne5icdczon6oduk,gao9gh4o63dzbrq,6m4w000evh3zk79,mi5dneai1wf4nfv",
    sindicato: "4eyz20yszdn9a27,0glmvgwg06lqo1r,oseusg3e84bimnn,gvxvi5qvf799e6g,4ag7s1vnphgclvh,bv8d8f86kud1znx,920j28lzi55jdr3,6p5lg1kvv180tb5,1giduz4jrloo7b1,mn8kv1fv3v30mfd",
    static: "xe0iw6x7rqt1eg6,ip295ttiyp6vb44,xy092c0o5fch9ws,5ahn3hrwerwa7ik,pi3nekrpvt428lj,jop0r0ixb0vebsy,r98a6an03che1tw,5jeshrlusvpl1qr,00c1fsbx504jk8l,6ux8vkiz84x9rtx,3teqe08g1rdj92l,6utsbiod77brk1n,a27f8l3tecu0jel,vshlibo8qmvxtco,w23emzha82fg2b1,9odj6phqenec8pq,df2f24u973sqtye,ijybmb3pi2m9qu6,wz37ufedj6max9p,u8xpt33cr3u9uv3,s7xdfk2mrw8o3ln,xa23ajny7k1vlec,8sicf4c6hgpel7j,4f15k6zeyb582hl"
  };
  const catalog = [
    ["series-guerra-das-sombras-milestone-1994", "Guerra das Sombras", "Shadow War", 6, 1994, "Dwayne McDuffie / Ivan Velez Jr. / Robert Washington", "Gabinete das Sombras", "O primeiro crossover da Milestone coloca duas facções do Gabinete das Sombras em conflito e reúne Hardware, Ícone, Superchoque, Rocket e Xombi.", "guerra", "https://static.dc.com/sites/default/files/imce/2023/01-JAN/ICvHW_Cv1_00111_63d182db1f1297.92931856.jpg"],
    ["series-hardware-milestone-1993", "Hardware", "Hardware", 16, 1993, "Dwayne McDuffie / Denys Cowan", "Curtis Metcalf", "Curtis Metcalf usa sua armadura e suas invenções para enfrentar o crime organizado e o empresário Edwin Alva.", "hardware", "https://static.dc.com/dc/files/default_images/14082_900x1350.jpg"],
    ["series-icone-milestone-1993", "Ícone", "Icon", 28, 1993, "Dwayne McDuffie / Denys Cowan", "Augustus Freeman IV / Rocket", "Um alienígena que vive na Terra há quase dois séculos assume a identidade de Augustus Freeman e encontra na jovem Rocket um motivo para voltar a agir como herói.", "icone", "https://static.dc.com/dc/files/default_images/Char_Gallery_IconICON_34_F_6036c947605ad2.10771124.jpg"],
    ["series-sindicato-de-sangue-milestone-1993", "Sindicato de Sangue", "Blood Syndicate", 35, 1993, "Ivan Velez Jr. / ChrisCross", "Wise Son / Tech-9 / Holocaust", "Uma gangue de rua afetada pelo Big Bang tenta sobreviver às disputas de poder, à polícia e aos perigos de Paris Island.", "sindicato", "https://static.dc.com/dc/files/default_images/BLDSYN_S1_Cv1_00111_62472a2035eb78.97538525.jpg"],
    ["series-superchoque-milestone-1993", "Super Choque", "Static", 24, 1993, "Dwayne McDuffie / Robert L. Washington / John Rozum", "Super Choque", "Após ser exposto a uma substância mutagênica, Virgil Hawkins ganha poderes eletromagnéticos e decide proteger a comunidade de Dakota City.", "static", "https://i.imgur.com/7HOYodR.jpg"]
  ];
  window.DEFAULT_SERIES = window.DEFAULT_SERIES || [];
  window.DEFAULT_LIBRARY = window.DEFAULT_LIBRARY || [];
  catalog.forEach(([id, name, originalTitle, count, year, author, character, description, key, coverUrl]) => {
    const blogUrl = sources[key];
    if (key === "hardware") character = "Hardware";
    if (key === "icone") character = "\u00cdcone";
    const fileLinks = ids[key].split(",").map(fileId => fileId.trim()).filter(Boolean).map(fileId => /^https?:\/\//i.test(fileId) ? fileId : `https://www.mediafire.com/file/${fileId}`);
    count = fileLinks.length;
    const numberedIssues = issueNumbers[key] || Array.from({ length: count }, (_, index) => index + 1);
    window.DEFAULT_SERIES.push({ id, name, seriesTitle: name, originalTitle, type: "comic", publisher, imprint, publication: key === "guerra" ? "Evento" : "Série Mensal", status: "Cancelada/Terminada", editions: String(count).padStart(2, "0"), year, description, coverUrl, blogUrl, telegramUrl: "", author, character, tags: [name, originalTitle, character, "DC Comics", "Milestone"], officialUrl: "https://www.dc.com/comics" });
    for (let n = 1; n <= count; n += 1) { const issueNumber = numberedIssues[n - 1]; window.DEFAULT_LIBRARY.push({ id: `${id}-${String(issueNumber).padStart(3, "0")}`, seriesId: id, title: name, issue: String(issueNumber), year, format: "cbz", fileUrl: fileLinks[n - 1] || "", coverUrl: key === "guerra" ? guerraCovers[n - 1] : key === "hardware" ? hardwareCovers[n - 1] || null : key === "icone" ? iconeCovers[n - 1] : key === "static" ? superchoqueCovers[n - 1] || null : n === 1 ? coverUrl : null, officialUrl: "https://www.dc.com/comics", sourceUrl: blogUrl, clicks: 0, featured: true, randomWeight: 5, collectionIds: [] }); }
  });
  sindicatoCovers.forEach((cover, index) => {
    const item = window.DEFAULT_LIBRARY.find(entry => entry.seriesId === "series-sindicato-de-sangue-milestone-1993" && Number(entry.issue) === index + 1);
    if (item) item.coverUrl = cover;
  });
  const superchoqueSeriesId = "series-superchoque-milestone-1993";
  superchoqueCovers.forEach((cover, index) => {
    const item = window.DEFAULT_LIBRARY.find(entry => entry.seriesId === superchoqueSeriesId && Number(entry.issue) === index + 1);
    if (item) item.coverUrl = cover;
  });
  const iconSeries = window.DEFAULT_SERIES.find(entry => entry.id === "series-icone-milestone-1993");
  if (iconSeries) iconSeries.secondaryCharacters = ["Foguete"];
})();
