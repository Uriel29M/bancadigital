(function () {
  const publisher = "DC Comics";
  const imprint = "Novos 52";
  const officialBase = "https://www.dc.com/comics/";
  // Cada posição corresponde à edição na ordem publicada pela página do Blogspot.
  // As URLs são preenchidas somente quando a capa individual foi confirmada.
  const coverUrlsBySeries = Object.create(null);
  const fileUrlsBySeries = Object.create(null);
  fileUrlsBySeries["series-action-comics-2011-novos-52"] = [
    "https://mega.co.nz/#!QcsglRiB!IRVXaTZjx4pMPeko7rikPm23xs9Wou1FH50DGrQYp64",
    "https://www.mediafire.com/?mj493vq947yax2a",
    "https://www.mediafire.com/?tih6csv4mvanqxh",
    "https://www.mediafire.com/?0tzfg96b0qv7qe0",
    "https://www.mediafire.com/?83d44tn2anl46h2",
    "https://www.mediafire.com/?oo4nnllsb80pub4",
    "https://www.mediafire.com/?2hcwtjuwwgks6ya",
    "https://www.mediafire.com/?3g3t8726to7v59k",
    "https://mega.co.nz/#!g98hgQRA!LYrhyAWNVOowJZ7Om9wGU2EwYaByzmoIUmKqv8FHzq8",
    "https://mega.co.nz/#!BlcmRbTR!BPnK_VxjiE4WVhCjGZPIB3CU5LBXhDaTFMbK71Ejs9I",
    "https://mega.co.nz/#!QpsCTCAI!TADkdEjAQbBYOgpudyIzvVHK6elYX2poCP5_tjHFOo8",
    "https://mega.co.nz/#!A4dgjBqQ!IiJF8DzRRWhtySEVlH3I8FV0DBNkWndmYcqnkeXBcTc",
    "https://mega.co.nz/#!Q80zTBgD!lwK2iyfuRt_HV-Q2ubAsNrGvVcxr3g2Dbpnv5KAUbJE",
    "https://mega.co.nz/#!phcWnboB!SSB-g2U7PX4wW4dI30pmwJ-jFmr63X60jwpqR-fqVE0",
    "https://mega.co.nz/#!coVhDAgI!YRhAigh4lyM5UI3gAIU1kcNf3Qnde_rYvejF_y1g8d8",
    "https://www.mediafire.com/?rcix38c48fj9aar",
    "https://www.mediafire.com/?9l7mn3adyc7hjnv",
    "https://mega.co.nz/#!msJTlICY!VHmiVp4ZHxZtnX0kwO1mNBtj9GUvszPnN-yROVFcvkk",
    "https://mega.co.nz/#!boAh1CCY!UhmEhnIhps1iWwk54fSSKhGCYnzePz0672b2U_EvRF8",
    "https://mega.co.nz/#!nopXhJKJ!XDwDyLae8Cb42RT6frR3K20KJfuKdd-JHofVsR5wAV8",
    "https://mega.co.nz/#!C0RzXZBZ!mEg3IsAovvbQSRPpuSam5w_4Z2orhWOlV4K_gqUo6Yo",
    "https://mega.co.nz/#!ahxwnAQS!8oe1s2q5QNJOF36OAjpNseCZpJHiWXLzCHOtQB6ftH8",
    "https://www.mediafire.com/?k4zdl6ca1bvkkm9",
    "https://mega.co.nz/#!c8dAnCqR!NkIq6PrvlnGIbcfi5k9lYtVBKQv-Dc0th1Fw3RUeO2E",
    "https://www.mediafire.com/?uo1ni2bykup7dms"
  ];
  fileUrlsBySeries["series-as-aventuras-do-superman-2013-novos-52"] = [
    "https://www.mediafire.com/file/2uwq43goylnfalb/Aventuras_do_Superman_%252301_%25282013%2529_%2528DarkseidClub%2529.cbr/file",
    "https://www.mediafire.com/file/rkv1y0kpsyxhgcz/Aventuras_do_Superman_%252302_%25282013%2529_%2528DarkseidClub%2529.cbr/file",
    "https://www.mediafire.com/file/pfor5o9ya2kngkz/Aventuras_do_Superman_%252303_%25282013%2529_%2528DarkseidClub%2529.cbr/file",
    "https://www.mediafire.com/file/2yoeege7gef4hh4/Aventuras_do_Superman_%252304_%25282015%2529_%2528DarkseidClub%2529.cbr/file",
    "https://www.mediafire.com/file/i477hx8nrq634dv/As_Aventuras_do_Superman_%252305_%25282013%2529_%2528SoQuadrinhos%2529.cbr/file"
  ];
  coverUrlsBySeries["series-as-aventuras-do-superman-2013-novos-52"] = [
    "https://comicvine.gamespot.com/a/uploads/scale_large/6/66303/3071429-adventures.jpg",
    "https://comicvine.gamespot.com/a/uploads/scale_large/6/67663/3132491-02.jpg",
    "https://comicvine.gamespot.com/a/uploads/scale_large/6/67663/3209777-03.jpg",
    "https://comicvine.gamespot.com/a/uploads/scale_large/6/66303/3268866-adventures%20of%20superman.jpg",
    "https://t.me/c/4424843914/60"
  ];
  coverUrlsBySeries["series-action-comics-2011-novos-52"] = [
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_sCc47cjNbkwPgfY-TCyUdCpXAYbyXGsLonOIpGaQfqdzp__CN6SQtMt5RatYtM2Zv_z_JaftnWsu7OZIrbF9hpcAzT3yyzmg0gjDT_fD8s_klkfJovZFGjbz7w8txn_1Q8Rvf-qGJQGpZh6g=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_sPPUg-i_eWQVl6LnJsO280tk98K0ZfGSRl-VP70hiF7MJTgN-m9BjGI-ifBRMope2qfeqCfWoTABgvgrS60gcuRSUQgzq3oziyRUuftqQ4BOJszUUJCNH9fwbqsvdVHj8zULI=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_ubr-E9VZIJTtcarhr2_OymG4lAlw4pAWRDVVEP6ZvhslY4riuwmgtHLY0G52vipbCeo2B3J7z8nb6e31z5KDujYtIs-yqqvc0Mx1pcV-xOIvDaGKASj2iZqfWYkqgrV3Rqv9U=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_uDoEh4Q12_N3nw8kD2bEXCvj2nXi3oYaCv8p2fK2cI0nskC-Nd0fbaqdJDwawLoZb4QAWCi0uNfqDZt3KOuD_5ZCbeuhnPtvNpNd6xmlz8-KPpFNArRbwzgjjx0A=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_sefKt4tMTKnm4FA8zg78TGim01JPvN1d0f3bWQaVyQv8z_eOqF6XD93WME7vIpeztoDzDq8aRgYlUoNRld4lyDjZjmfnzT4bd0Ioa4NuwtlGqYiAPkOQnaNw=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_vyIonmjI2_Uv6-2YA-iVdpodJRdYI_lQLmcZxNW7mKBSFbU-DcW4-DKjqgnHJfzSNpfC6W0hHapElV5bWHgb242FrpxoAQV-LFxwNDAWIKbYQHi8n_CcGp7Rqfpwji=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_uLQySdzRpXOBVVD4xFTY9SIXrSAxqm-0SbOhgIR3cCafYDyvGusomha3Bh4umX6hxOY7op0mroIjPsQ7nNuV4IavEzKLcaNdOysDsWP5CdU7-9V-XnHBWWbzGMwh_J7xePebmc9RwOVtam=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_uh1IrUEiy40eZihJkvbrWyx_KRB_sAxvp4srHJufh5QY_Ar_C1H8rx-plDiyD32VJQjzzV7R3YnTASfEkZWFIUhJlDlY5dcu57u7jwPLUPXJs=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_tN3DRTQXLynrzyJfQscy6yg5v425iJwsZQ2R--NODzx9qSGDV7jq-YF-HmqWQY01l3a1Pkj5axI-G1fVmOlSGjsXhfYCG7akAPvLW3Nrr10hE=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_u1aAX1Cn1tNxoDEqHJnvXGcP-83JIUMfYDFp7bWqccMmSO1dP_A-k_PcCigku1tTWngKykWgCpg40aMv6YKzUG9F4k1muMzfbXMUc8GILoY-wg8Q=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_vCXOtno-E_0ZJVydo44dDG2zaD7fF_6Y9letWqMbyWJmMPdBW_Me5PktlWUqZoAhFtV-5CX0d5ub_Qw3SHu5lk-XQQ4M4-Um8CLn8e5zBFqQUpYw=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_vMJ9XgeUqCBLCplCNMdPdJKmAXcTC3DBG4X5Wdw-M4LkB8J8A3kQE5bum7UiCQ7j0RvTitlE7Kt6j4s0i0ev1oJIcekqp4yFFqKtIWov-buyqbBs_l9xwFNs7D=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_v54v5VfisinL0K8cHPXQlSqYWSqkyILyr8-P1i4tra2QNogjYCfI8hj0es7d0AFrrKm0kXtabt7fZU6vuFHxNA860R5Fl0DzTmAil7kwjXyx1d57dUok_irqkS=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_tdWfr-YAj32rnXCx1nYuetRziZcgOdadrrnlwJPLC9-JSYlQmS8KWzifXq4mItmS_L0ieBkO4OXJKVbW1LqNNIEt-ZIy9goLacztuFaIZYEBggtC9IG3PPYQ=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_vKLimPwTopQxp8UoPpE-5ufjA2KwBG7JtRvDzgHTzrDjYjaavujUqTkmG6D2FyXvnR7PdJKUFvtqgasHM0J0uOd9EsGmEZU_jHFI162r5uaLlWFQ=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_tt6xWGUR_EaXNYXM7NuLz87YCyWaORGVst6OsQlhdmqwm0TGw4vxNAUBchHmyCYExR-4qu3jJlhQ7SUdiiq--DAQ=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_vdjpCaf_jNkhxO94EJjQ6iZGZVNZr6cT23Lyq3T1VwgeK8RZOUze4v1weBFfZ08dLyKviszWtIJqHmkwzEln912w=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_uw2MHkMhqJvBxygtxqrzX9NSSpvRApRQrzZxUfed6360QGruBXuYCgDVl7Q3uOYnrdvKEU-4ZltnryNRzP9D_uLg=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_vVY5uVb5hCXImhFlsQkSC1VCr0_5Djd1bup6TVnE77ofD4lIjnwWapN2R-GpZWynNwZFdyfTygDFDRTNSCk4Y7iQ=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_smwiIdKOVrgcKMujHgxzEuxNv24V3dj__lAMxOKzh6nbVNiNh0A46d03ZXBrkpuf0x8dMDuQJEpwPL6TxqqV_mQg=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_sXUv87gRFhgpumjwrHk9D0XdcOmJhnwoQ1hmfCtWVo7eDNMMwv0qZFq3Kv1vweHjskHYxoETdG0_ARKc2BTQZzrg=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_uOBruYcP61qMKsQJa32YVEBuvEVuHc1OpcXrUT4Q8G6YpgMTzVvewCCJJIXOmyZTF9Tj9sovkrtKP36NB3QpYVKA=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_tdryqZNKxcysc5751sS-75acPG8B3nncXwmT27o-1_YANuKklmrdJ5BqMXE_4M8xfCa6LPEcGl97pTdPYqPEymrV74d7XOQR-GZUsm6aVN=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_uHn3R17STCEb_7df3zjoWqdU-OtlZgLUZBiZATSI7ZVB0filcfHPpGl4fW_5PZkUbJVzpxZCVMdr8uIB5M1A=s0-d",
    "https://lh3.googleusercontent.com/blogger_img_proxy/AEn0k_vXJfjwF7MYg-kSFmft4shlcsvS6jHZU3dTDHUtLEKKF7UTMaUAw-oqi2V13t6nqkTNrx3gNLvYtPqC-ku0GRoT_Olp6K1Ek_FxhjNvAIpGuLz8=s0-d"
  ];
  // Capas oficiais da DC, indexadas pela mesma ordem das edições do Action Comics.
  coverUrlsBySeries["series-action-comics-2011-novos-52"] = [
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_1_5b1c3b9d9e12b8.95435432.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_2_5b1c3ba9d15f99.65484875.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_3_5b1c3bb49d56e3.90569669.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_4_5b1c3bccb206e8.60369815.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_5_5b1c3bd99f70d0.40590088.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_6_5b1c3be509b646.72089689.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_7_5b1c3bf02afff8.80577145.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_8_5b1c3bffbf3fa0.40808290.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_9_5b1c3c18400cc4.10604870.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_10_5b1c3c2584e921.14101223.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_11_5b1c3cbfd22275.54230300.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_12_5b1c3e97aa9a32.56906204.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_0_5bb25f1a1819b6.49493577.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_13_5b104df5334c99.70379015.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_14_5b104dfeda05b2.51427341.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_15_5b1c3eee8dc0e2.60432186.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_16_5b1c3efb6690d9.79549069.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_17_5b104e5cc7dca5.18948926.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_18_5b1c3f0dac35c8.57508355.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_19_5b104e6e24b236.95442759.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_20_5b104e7f46a594.88825247.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_21_5b1c3f29637480.93792760.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_22_5b104e9e798f59.41836241.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_annual_v2_1_5b1c3edf44f246.93896920.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_annual_v2_2_5b1c3feea5b8c1.25550090.jpg"
  ];
  // Fonte atualizada: Timeline Comics. As URLs do Drive abaixo seguem a ordem
  // exibida na página, sem incluir a pasta agregada ao final do artigo.
  fileUrlsBySeries["series-action-comics-2011-novos-52"] = [
    "https://drive.google.com/file/d/0B8S09qODXLIHcTdvUWtLMlpLc00/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHaENXOTVLQnhJZ1k/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHVERYcS1FbHAtRVk/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHMlc5OHEyRmhiRU0/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHVkpLSnhSRFFMRzA/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHY3FoX0JpYnhiRXc/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHdlprTkJoS0ZuZlE/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHbmM2QXRDSTlOdDA/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHa3lXZE5peko2emc/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHalNhZHJYa2pwWkE/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHOUVoVVYwN2huVFk/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHcHI0T29lSjJZNlk/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHWHNsZGFBRzJ5OEE/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHY3c1bk9ZNHpEeE0/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHT254b2FOTm8wYjg/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHdHlUUF9pOHFicGM/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHRjBHaF9BVVFDaEk/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHSHFhQlhrT3ZGVm8/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHbzVJR1c3b0VfRDQ/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHX3lKbWtMVjQ5Y1E/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHSG1Zd2hXMF9lYmc/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHV180bUFoMjBfd1U/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHckY2WGxiTWM1cFE/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHSEhIa2Y2dURsc1U/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHeHZ4VDR5Q1lXdDA/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHVWFYLWFBR3hhdE0/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHdnBQWE1HMFBJRmc/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHV0sxV0ZQR1RROTQ/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHb3lKWjluNGRGcWs/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHeUhsVlE1bFl1bVk/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHUGNYWVlIODhRT0k/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHZ0pmdG5ESzE1QVU/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHQ2wtZHc4UWF1Rzg/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHNnZaRERmZU4xdUU/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHeEZKTDlBb3BTalk/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHN1Jmc2liNHpDalU/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHa0g5c3piWEpLbDA/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHT21jUzVfcUpVQlE/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHX0FxRG9sUDY2ZW8/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHb2tOMDZGdW82X1U/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHbV8zMXZHaThaUUU/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHWDJ0MTJ3dTQyOFE/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHUTA4NUV5QXI2eVk/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHRTUzeFRBOWNXRnM/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHdGNmMWJ1eFNyNmM/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHQ0FVallWMVJxWFU/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHRWlJVjhWWHJzeVE/view?usp=sharing",
    "https://drive.google.com/file/d/0BwNN_dNDOY0Wd3QyZWVaZVVqUnM/view?usp=sharing",
    "https://drive.google.com/open?id=0BwNN_dNDOY0WYXZMWnpWSXlHZTQ",
    "https://drive.google.com/file/d/0BwNN_dNDOY0WUXdVNnYtdXZYcGM/view?usp=sharing",
    "https://drive.google.com/file/d/0BwNN_dNDOY0WUlRLeVVSeDkyaEE/view?usp=sharing",
    "https://drive.google.com/file/d/0BwNN_dNDOY0WcE96NTE0QS1EVGs/view?usp=sharing",
    "https://drive.google.com/file/d/0BwNN_dNDOY0Wc0tzTVlHNlRINms/view?usp=sharing",
    "https://drive.google.com/file/d/0BwNN_dNDOY0WX01VeDB4Z2gzWWs/view?usp=sharing",
    "https://drive.google.com/file/d/0BwNN_dNDOY0WUjRUNXJEaldKN2M/view?usp=sharing",
    "https://drive.google.com/file/d/0BwNN_dNDOY0WVm5LMUF2UVo3Wkk/view?usp=sharing",
    "https://drive.google.com/open?id=0B2AOzvnwI3s1SjdyQ2xybC1iYVU",
    "https://drive.google.com/open?id=0B2AOzvnwI3s1Uldpa3pldTZ4Qlk",
    "https://drive.google.com/file/d/0B8S09qODXLIHMFZYVmZPSzZ6LUE/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHdUhCMUNkTFpuN0U/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHb3A1YnFXX0dDUms/view?usp=sharing",
    "https://drive.google.com/file/d/0B8S09qODXLIHcEJVM25Qd3JGWGM/view?usp=sharing"
  ];
  coverUrlsBySeries["series-action-comics-2011-novos-52"] = [
    "https://static.dc.com/dc/files/default_images/AC-DCSneakPeek_SFCovers_1332x2048_554a49dae08ec3.00073816.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_1_5b1c3b9d9e12b8.95435432.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_2_5b1c3ba9d15f99.65484875.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_3_5b1c3bb49d56e3.90569669.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_4_5b1c3bccb206e8.60369815.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_5_5b1c3bd99f70d0.40590088.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_6_5b1c3be509b646.72089689.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_7_5b1c3bf02afff8.80577145.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_8_5b1c3bffbf3fa0.40808290.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_9_5b1c3c18400cc4.10604870.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_10_5b1c3c2584e921.14101223.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_11_5b1c3cbfd22275.54230300.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_12_5b1c3e97aa9a32.56906204.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_0_5bb25f1a1819b6.49493577.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_13_5b104df5334c99.70379015.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_14_5b104dfeda05b2.51427341.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_15_5b1c3eee8dc0e2.60432186.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_16_5b1c3efb6690d9.79549069.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_17_5b104e5cc7dca5.18948926.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_18_5b1c3f0dac35c8.57508355.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_19_5b104e6e24b236.95442759.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_20_5b104e7f46a594.88825247.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_21_5b1c3f29637480.93792760.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_22_5b104e9e798f59.41836241.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_23_5b104ea570d4b8.91676150.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_23.1_5b1c3fbe300e74.13038063.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_23.2_5b104f1f5a59e8.02932475.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_23.3_5b104f27a65de7.92832984.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_23.4_5b1c3fce50ac39.76574839.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_24_5b1c3fdf37be71.44898156.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_25_5b1c4003b0f934.48046608.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_26_5b104fb31a9635.48810588.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_27_5b1c401c956cf8.89527561.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_28_5b1c4080dbe8d7.77527515.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_29_5b104fd2b5c563.96955475.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_30_5b105048661c18.83333135.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_31_5b105050f21642.16808704.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_32_5b10505856e823.11083604.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_33_5b10505f39ca88.48496094.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_34_5b1050663a3fc4.06204364.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_35_5b1c40907d1057.76633000.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_36_5b1c40a13dd512.80450572.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_37_5b1c40af2abb49.14619386.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_38_5b1c40bdd72e50.28583081.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_39_5b1c40cc6c0a33.89531794.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_40_5b1c40dcdd9108.45314849.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_41_5b1c40f013f389.82117472.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_42_5b10514f0faeb0.21489677.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_43_5b1c40ff9c39e6.55130461.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_44_5b1c410c0c0bd7.41427203.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_45_5b1c4119967322.52810248.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_46_5b1c4129ab55c5.49009583.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_47_5b1051a9e11c04.82082225.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_48_5b1051b078dfe5.72271642.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_49_5b1051bc816668.77091615.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_50_5b1051d394c6b9.24238067.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_51_5b1051da1b6033.62946432.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_v2_52_5b1c413a41ea29.61154712.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_annual_v2_1_5b1c3edf44f246.93896920.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_annual_v2_2_5b1c3feea5b8c1.25550090.jpg",
    "https://static.dc.com/dc/files/default_images/actioncomics_annual_3_5b1052eae3ce05.69276156.jpg",
    "https://static.dc.com/dc/files/default_images/FE_AC_Cv1_A_934x1200_53756fd30ec7a1.35348150.jpg"
  ];

  const catalog = [
    ["series-action-comics-2011-novos-52", "Action Comics", "Action Comics", "Grant Morrison / Rags Morales", "Superman", "A nova fase de Superman começa com uma releitura de seus primeiros dias em Metrópolis.", "action-comics-2011/action-comics-1", "https://hqs-soquadrinhos.blogspot.com/2011/09/action-comics-v2-2011.html", 25, "https://comicvine.gamespot.com/a/uploads/original/0/9116/1998210-1a.jpg", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, "Anual 01", "Anual 02"]],
    ["series-all-star-western-2011-novos-52", "All Star Western", "All-Star Western", "Justin Gray / Jimmy Palmiotti / Moritat", "Jonah Hex", "Jonah Hex chega a uma Gotham ainda no começo de sua história e se une a Amadeus Arkham para investigar crimes brutais.", "all-star-western-2011/all-star-western-1", "https://hqs-soquadrinhos.blogspot.com/2011/10/all-star-western-2011.html", 35, "http://img42.imageshack.us/img42/821/allstarwestern1thegroup.jpg", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34]],
    ["series-all-star-secao-oito-2015-novos-52", "All-Star Seção Oito", "All Star Section Eight", "Garth Ennis / John McCrea", "Sixpack", "Sixpack reúne novamente a equipe Seção Oito para enfrentar uma ameaça em Gotham.", "all-star-section-eight-2015/all-star-section-eight-1", "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html", 7, "https://t.me/c/4424843914/55"],
    ["series-antes-de-watchmen-2012-novos-52", "Antes de Watchmen", "Before Watchmen", "Vários autores", "Watchmen", "Minisséries que exploram o passado de personagens do universo de Watchmen.", "before-watchmen-2012/before-watchmen-ozymandias-1", "https://hqs-soquadrinhos.blogspot.com/2011/08/antes-de-watchmen-comediante-2012.html", 34, "https://i.imgur.com/iOQKAbi.jpg"],
    ["series-aquaman-2011-novos-52", "Aquaman", "Aquaman", "Geoff Johns / Ivan Reis / Joe Prado", "Aquaman / Mera", "Arthur Curry tenta equilibrar seu papel como rei de Atlântida com as ameaças que surgem das profundezas do oceano.", "aquaman-2011/aquaman-1", "http://hqs-soquadrinhos.blogspot.com/2011/10/aquaman-2011.html", 23, "https://static.wikia.nocookie.net/marvel_dc/images/5/51/Aquaman_0024.jpg"],
    ["series-arlequina-2013-novos-52", "Arlequina", "Harley Quinn", "Amanda Conner / Jimmy Palmiotti", "Arlequina", "Harley Quinn assume o protagonismo em uma série irreverente, caótica e cheia de humor.", "harley-quinn-2013/harley-quinn-0", "http://hqs-soquadrinhos.blogspot.com.br/2013/12/arlequina-2013.html", 19, "https://static.dc.com/dc/files/default_images/hquinn_v2_0_5b170b71f26ee8.48700576.jpg"],
    ["series-arqueiro-verde-2011-novos-52", "Arqueiro Verde", "Green Arrow", "J. T. Krul / Andrea Sorrentino / Jeff Lemire", "Arqueiro Verde", "Oliver Queen percorre o mundo em busca de justiça enquanto enfrenta inimigos e segredos ligados à própria família.", "green-arrow-2011/green-arrow-1", "http://hqs-soquadrinhos.blogspot.com/2011/08/arqueiro-verde-2011.html", 25, "https://static.dc.com/dc/files/default_images/garrow_v5_1_5b172067b04b84.18177226.jpg"],
    ["series-asa-noturna-2011-novos-52", "Asa Noturna", "Nightwing", "Kyle Higgins / Eddy Barrows", "Asa Noturna", "Dick Grayson retorna a Gotham e encara mistérios ligados ao circo onde passou a infância.", "nightwing-2011/nightwing-1", "http://hqs-soquadrinhos.blogspot.com/2011/09/asa-noturna-v3-012011.html", 31, "https://i.postimg.cc/FHBKHM4d/RG7htl-Y.jpg"],
    ["series-as-aventuras-do-superman-2013-novos-52", "As Aventuras do Superman", "Adventures of Superman", "Jeff Parker / Jeff Lemire / Justin Jordan", "Superman", "Histórias independentes que mostram novas aventuras do Homem de Aço e seus encontros com ameaças clássicas.", "adventures-of-superman-2013/adventures-of-superman-1", "https://hqs-soquadrinhos.blogspot.com/2019/02/as-aventuras-do-superman-2013.html", 5, "https://comicvine.gamespot.com/a/uploads/scale_large/6/66303/3071429-adventures.jpg"],
    ["series-aves-de-rapina-2011-novos-52", "Aves de Rapina", "Birds of Prey", "Duane Swierczynski / Jesús Saíz", "Canário Negro / Starling", "Canário Negro e Starling formam uma equipe de operações secretas enquanto tentam limpar seus nomes.", "birds-of-prey-2011/birds-of-prey-1-2011", "http://hqs-soquadrinhos.blogspot.com/2011/08/aves-de-rapina-2011.html", 28, "https://img33.imageshack.us/img33/3966/20095400x600.jpg"],
    ["series-furia-do-nuclear-2011-novos-52", "A Fúria do Nuclear: Os Homens Nucleares", "The Fury of Firestorm: The Nuclear Men", "Ethan Van Sciver / Gail Simone / Yildiray Cinar", "Firestorm", "Jason Rusch e Ronnie Raymond precisam lidar com as consequências do poder do Nuclear e com novos Firestorms.", "the-fury-of-firestorm-the-nuclear-men-2011/the-fury-of-firestorm-the-nuclear-men-0", "http://hqs-soquadrinhos.blogspot.com/2011/11/furia-do-nuclear-os-homens-nucleares.html", 21, "https://static.dc.com/dc/files/default_images/fury_firestorm_0_5b2450ff59f451.42227336.jpg"]
  ];

  window.DEFAULT_SERIES = window.DEFAULT_SERIES || [];
  catalog.forEach(([id, name, originalTitle, author, character, description, officialPath, blogUrl, issueCount, coverUrl, issueNumbers]) => {
    window.DEFAULT_SERIES.push({
      id,
      name,
      seriesTitle: name,
      originalTitle,
      type: "comic",
      publisher,
      imprint,
      publication: id === "series-all-star-secao-oito-2015-novos-52" || name === "Antes de Watchmen" ? "Minissérie" : "Série Mensal",
      status: "Cancelada/Terminada",
      editions: String(issueCount).padStart(2, "0"),
      year: Number((officialPath.match(/20\d{2}/) || ["2011"])[0]),
      description,
      coverUrl,
      blogUrl,
      telegramUrl: "",
      author,
      character,
      tags: [name, originalTitle, character, "DC Comics", "Novos 52"],
      officialUrl: officialBase + officialPath
    });
    for (let index = 0; index < issueCount; index += 1) {
      const issue = issueNumbers?.[index] ?? index + 1;
      window.DEFAULT_LIBRARY = window.DEFAULT_LIBRARY || [];
      window.DEFAULT_LIBRARY.push({
        id: `${id}-${String(issue).padStart(3, "0")}`,
        seriesId: id,
        title: name,
        issue: String(issue),
        sortOrder: index + 1,
        year: Number((officialPath.match(/20\d{2}/) || ["2011"])[0]),
        format: "comic",
        fileUrl: fileUrlsBySeries[id]?.[index] || "",
        coverUrl: coverUrlsBySeries[id]?.[index] || (issue === 1 ? coverUrl : ""),
        officialUrl: officialBase + officialPath,
        sourceUrl: blogUrl,
        clicks: 0,
        featured: true,
        randomWeight: 5,
        collectionIds: []
      });
    }
  });
  // Reconstroi Action Comics com a ordem e os 62 links individuais da Timeline.
  // Isso tambem corrige catalogos antigos que ainda tinham apenas 25 entradas.
  const actionSeriesId = "series-action-comics-2011-novos-52";
  const actionBlogUrl = "https://timelinecomics.blogspot.com/2016/02/action-comics-volume-2-dc.html";
  const actionIssueLabels = [
    "Sneak Peek", "001", "002", "003", "004", "005", "006", "007", "008", "009", "010", "011", "012", "000",
    "013", "014", "015", "016", "017", "018", "019", "020", "021", "022", "023", "023-1", "023-2", "023-3", "023-4",
    "024", "025", "026", "027", "028", "029", "030", "031", "032", "033", "034", "035", "036", "037", "038", "039", "040", "041", "042", "043", "044", "045", "046", "047", "048", "049", "050", "051", "052",
    "Anual 01", "Anual 02", "Anual 03", "Futures End"
  ];
  const actionIssueKey = issue => {
    if (issue === "Sneak Peek") return "sneak-peek";
    if (issue === "Anual 03") return "2014";
    if (issue === "Futures End") return "futures-end";
    return issue;
  };
  const actionOfficialUrl = issue => {
    if (issue === "Sneak Peek") return `${officialBase}action-comics-2011/dc-sneak-peek-action-comics-2015`;
    if (issue === "Anual 01") return `${officialBase}action-comics-2011/action-comics-annual-1`;
    if (issue === "Anual 02") return `${officialBase}action-comics-2011/action-comics-annual-2`;
    if (issue === "Anual 03") return `${officialBase}action-comics-2011/action-comics-annual-3`;
    if (issue === "Futures End") return `${officialBase}futures-end-2014/action-comics-futures-end-1`;
    const villainPages = {
      "023-1": "action-comics-23-1-cyborg-superman",
      "023-2": "action-comics-23-2-zod",
      "023-3": "action-comics-23-3-lex-luthor",
      "023-4": "action-comics-23-4-metallo"
    };
    if (villainPages[issue]) return `${officialBase}action-comics-2011/${villainPages[issue]}`;
    return `${officialBase}action-comics-2011/action-comics-${Number(issue)}`;
  };
  const actionSeries = {
    id: actionSeriesId,
    name: "Action Comics",
    seriesTitle: "Action Comics",
    originalTitle: "Action Comics",
    type: "comic",
    publisher,
    imprint,
    publication: "Série Mensal",
    status: "Cancelada/Terminada",
    editions: String(actionIssueLabels.length).padStart(2, "0"),
    year: 2011,
    description: "A nova fase de Superman começa com uma releitura de seus primeiros dias em Metrópolis.",
    coverUrl: coverUrlsBySeries[actionSeriesId][0],
    blogUrl: actionBlogUrl,
    telegramUrl: "",
    author: "Grant Morrison / Rags Morales",
    character: "Superman",
    tags: ["Action Comics", "Action Comics", "Superman", "DC Comics", "Novos 52"],
    officialUrl: actionOfficialUrl("001")
  };
  const actionItems = actionIssueLabels.map((issue, index) => {
    const year = issue === "Sneak Peek" ? 2015 : issue === "Anual 01" ? 2012 : issue === "Anual 02" ? 2013 : issue === "Anual 03" || issue === "Futures End" ? 2014 : 2011;
    return {
      id: `${actionSeriesId}-${String(actionIssueKey(issue)).padStart(3, "0")}`,
      seriesId: actionSeriesId,
      title: "Action Comics",
      seriesTitle: "Action Comics",
      issue,
      sortOrder: index + 1,
      year,
      format: "pdf",
      fileUrl: fileUrlsBySeries[actionSeriesId][index] || "",
      coverUrl: coverUrlsBySeries[actionSeriesId][index] || "",
      officialUrl: actionOfficialUrl(issue),
      sourceUrl: actionBlogUrl,
      clicks: 0,
      featured: true,
      randomWeight: 5,
      collectionIds: []
    };
  });
  const actionSeriesIndex = window.DEFAULT_SERIES.findIndex(series => series.id === actionSeriesId);
  if (actionSeriesIndex >= 0) window.DEFAULT_SERIES.splice(actionSeriesIndex, 1, actionSeries);
  const firstActionItemIndex = window.DEFAULT_LIBRARY.findIndex(item => item.seriesId === actionSeriesId);
  const remainingActionItems = window.DEFAULT_LIBRARY.filter(item => item.seriesId !== actionSeriesId);
  window.DEFAULT_LIBRARY = firstActionItemIndex < 0
    ? [...remainingActionItems, ...actionItems]
    : [...remainingActionItems.slice(0, firstActionItemIndex), ...actionItems, ...remainingActionItems.slice(firstActionItemIndex)];
  // Edições e capas de All-Star Seção Oito fornecidas para o catálogo.
  const sectionEightId = "series-all-star-secao-oito-2015-novos-52";
  const sectionEightItems = [
  {
    "id": "series-all-star-secao-oito-2015-novos-52-sneak-peek",
    "name": "All-Star Seção Oito",
    "originalTitle": "All Star Section Eight",
    "type": "comic",
    "blogUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "officialUrl": "https://www.dc.com/comics/all-star-section-eight-2015/all-star-section-eight-1",
    "seriesId": "series-all-star-secao-oito-2015-novos-52",
    "issue": "Sneak Peek",
    "sortOrder": 0,
    "format": "comic",
    "fileUrl": "",
    "sourceUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "clicks": 0,
    "featured": true,
    "randomWeight": 5,
    "collectionIds": [],
    "downloadCount": 0,
    "title": "All-Star Seção Oito",
    "year": 2015,
    "telegramUrl": "https://t.me/c/4424843914/54",
    "coverUrl": "https://t.me/c/4424843914/59",
    "catalogEditedAt": "2026-09-08T23:06:11.455Z"
  },
  {
    "id": "series-all-star-secao-oito-2015-novos-52-001",
    "name": "All-Star Seção Oito",
    "originalTitle": "All Star Section Eight",
    "type": "comic",
    "blogUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "officialUrl": "https://www.dc.com/comics/all-star-section-eight-2015/all-star-section-eight-1",
    "seriesId": "series-all-star-secao-oito-2015-novos-52",
    "issue": "1",
    "sortOrder": 1,
    "format": "pdf",
    "fileUrl": "",
    "sourceUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "clicks": 0,
    "featured": true,
    "randomWeight": 5,
    "collectionIds": [],
    "downloadCount": 0,
    "title": "All-Star Seção Oito",
    "year": 2015,
    "telegramUrl": "https://t.me/c/4424843914/56",
    "coverUrl": "https://vqfmbpqurapcsuixgvql.supabase.co/functions/v1/telegram-cover?url=https%3A%2F%2Ft.me%2Fc%2F4424843914%2F69",
    "telegramFileId": "BQACAgEAAyEFAAMBB73CigADOGqf-88wjl5dpcykK7Ssa6uF0h2iAAK3CAAC830BReGZcIwhjjO8PQQ",
    "telegramFileName": "1 Eu Sempre Me Pergunto O Que O Vinicultor Compra.pdf",
    "telegramFileSize": 25651234,
    "catalogEditedAt": "2026-09-09T00:17:32.685467+00:00"
  },
  {
    "id": "series-all-star-secao-oito-2015-novos-52-002",
    "name": "All-Star Seção Oito",
    "originalTitle": "All Star Section Eight",
    "type": "comic",
    "blogUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "officialUrl": "https://www.dc.com/comics/all-star-section-eight-2015/all-star-section-eight-1",
    "seriesId": "series-all-star-secao-oito-2015-novos-52",
    "issue": "2",
    "sortOrder": 2,
    "fileUrl": "",
    "sourceUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "clicks": 0,
    "featured": true,
    "randomWeight": 5,
    "collectionIds": [],
    "downloadCount": 0,
    "title": "All-Star Seção Oito",
    "year": 2015,
    "telegramUrl": "https://t.me/c/4424843914/58",
    "coverUrl": "https://t.me/c/4424843914/70",
    "telegramFileId": "BQACAgEAAyEFAAMBB73CigADOmqf-9y21vG_MDCyQeXJpbSVpSOLAAK5CAAC830BRXXzrKA9IMbvPQQ",
    "telegramFileName": "2 Não É Fácil Ser Verde.pdf",
    "telegramFileSize": 27331721,
    "format": "pdf",
    "catalogEditedAt": "2026-09-08T23:06:11.455Z"
  },
  {
    "id": "series-all-star-secao-oito-2015-novos-52-003",
    "name": "All-Star Seção Oito",
    "originalTitle": "All Star Section Eight",
    "type": "comic",
    "blogUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "officialUrl": "https://www.dc.com/comics/all-star-section-eight-2015/all-star-section-eight-1",
    "seriesId": "series-all-star-secao-oito-2015-novos-52",
    "issue": "3",
    "sortOrder": 3,
    "format": "comic",
    "fileUrl": "https://www.mediafire.com/file/ge89th55687ritz/Se%25C3%25A7%25C3%25A3o_Oito_%252803_de_06%2529_%2528Gibiscuits%2529.cbr/file",
    "sourceUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "clicks": 0,
    "featured": true,
    "randomWeight": 5,
    "collectionIds": [],
    "downloadCount": 0,
    "title": "All-Star Seção Oito",
    "year": 2015,
    "telegramUrl": "",
    "coverUrl": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhHp8LnZFfi5NA1X3rxMWhjwXlYP9aE94WEhox9cnFDP7J3axHELkrK42BieQyPZjTl0jxc90F7NDrUExFbLGqIk0RPGhWFlh0Zc6fBjsI0eGSMNN_zHAbrfj8gAQVW4CeTMcjeDDCWvKs/s320/All-Star-Section-Eight-%25282015-%2529-003-000.jpgg",
    "catalogEditedAt": "2026-09-08T23:06:11.455Z"
  },
  {
    "id": "series-all-star-secao-oito-2015-novos-52-004",
    "name": "All-Star Seção Oito",
    "originalTitle": "All Star Section Eight",
    "type": "comic",
    "blogUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "officialUrl": "https://www.dc.com/comics/all-star-section-eight-2015/all-star-section-eight-1",
    "seriesId": "series-all-star-secao-oito-2015-novos-52",
    "issue": "4",
    "sortOrder": 4,
    "format": "comic",
    "fileUrl": "https://www.mediafire.com/file/9wooawlu4dy4wxl/Se%25C3%25A7%25C3%25A3o_Oito_%252804_de_06%2529_%2528Gibiscuits%2529.cbr/file",
    "sourceUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "clicks": 0,
    "featured": true,
    "randomWeight": 5,
    "collectionIds": [],
    "downloadCount": 0,
    "title": "All-Star Seção Oito",
    "year": 2015,
    "telegramUrl": "",
    "coverUrl": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgrM1f3lomQFqcRjXsWu34tlUJoQp1MCzqn4cbdZFxrwGja8t9KA2OR4WEyLME3m2GFHlmNMijNTfAw9mr9nxpBKVE-LxTAWyTBEO3hNc-fk2j_ujZ9Nx-gnAy9m5rmfUzWIDyn08GxnFc/s320/All-Star+Section+Eight+%25282015-%2529+004-000.jpg",
    "catalogEditedAt": "2026-09-08T23:06:11.455Z"
  },
  {
    "id": "series-all-star-secao-oito-2015-novos-52-005",
    "name": "All-Star Seção Oito",
    "originalTitle": "All Star Section Eight",
    "type": "comic",
    "blogUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "officialUrl": "https://www.dc.com/comics/all-star-section-eight-2015/all-star-section-eight-1",
    "seriesId": "series-all-star-secao-oito-2015-novos-52",
    "issue": "5",
    "sortOrder": 5,
    "format": "comic",
    "fileUrl": "https://www.mediafire.com/file/zlio7ej345lq9lg/Se%25C3%25A7%25C3%25A3o_Oito_%252805_de_06%2529_%2528Gibiscuits%2529.cbr/file",
    "sourceUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "clicks": 0,
    "featured": true,
    "randomWeight": 5,
    "collectionIds": [],
    "downloadCount": 0,
    "title": "All-Star Seção Oito",
    "year": 2015,
    "telegramUrl": "",
    "coverUrl": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhvTKWKzxNNZOPG_JIgjBXJw7ZqRc3tqChVa_k5NHCDNf8k49UEmbww43K8emZxtaMyoa-D-M_RbSAnYXduMtw4UJxhvDeqy5Souw0dgiPLARberwPqBO8a009D9pJgVfqglwgWUtU4kKM/s320/All-Star-Section-Eight-%25282015-%2529-005-000.jpg",
    "catalogEditedAt": "2026-09-08T23:06:11.455Z"
  },
  {
    "id": "series-all-star-secao-oito-2015-novos-52-006",
    "name": "All-Star Seção Oito",
    "originalTitle": "All Star Section Eight",
    "type": "comic",
    "blogUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "officialUrl": "https://www.dc.com/comics/all-star-section-eight-2015/all-star-section-eight-1",
    "seriesId": "series-all-star-secao-oito-2015-novos-52",
    "issue": "6",
    "sortOrder": 6,
    "format": "comic",
    "fileUrl": "https://www.mediafire.com/file/pqd2pkiqudncu13/Se%25C3%25A7%25C3%25A3o_Oito_%252806_de_06%2529_%2528Gibiscuits%2529.cbr/file",
    "sourceUrl": "http://hqs-soquadrinhos.blogspot.com/2015/06/secao-oito-2015.html",
    "clicks": 0,
    "featured": true,
    "randomWeight": 5,
    "collectionIds": [],
    "downloadCount": 0,
    "title": "All-Star Seção Oito",
    "year": 2015,
    "telegramUrl": "",
    "coverUrl": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgOY2nMCjopEil_lzH3z4FT-ONtFSEXaYA9PZuftw9o0qsnDE4NCA0D5xK9gvNS3GcFSvdJjK_QOdakx1AkqkiuQUOdRmFVKNvhCwkU6fYH-H0zuNlGfCpmeZ2ZIekdjFfw7q2kX5hqF5Q/s320/All-Star-Section-Eight-%25282015-%2529-006-%2528Cypher-2.0-Empire%2529-001.jpg",
    "catalogEditedAt": "2026-09-08T23:06:11.455Z"
  }
];
  window.DEFAULT_LIBRARY = window.DEFAULT_LIBRARY.filter(item => item.seriesId !== sectionEightId);
  window.DEFAULT_LIBRARY.push(...sectionEightItems);

})();
