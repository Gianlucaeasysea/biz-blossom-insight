import { useMemo, useState, useRef, useCallback } from 'react';
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup,
} from 'react-simple-maps';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Order } from '@/types/analytics';
import { ZoomIn, ZoomOut, RotateCcw, MapPin, Filter } from 'lucide-react';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const NUM_TO_A2: Record<string, string> = {
  '004':'AF','008':'AL','012':'DZ','024':'AO','032':'AR','036':'AU','040':'AT',
  '050':'BD','056':'BE','068':'BO','076':'BR','100':'BG','124':'CA','144':'LK',
  '152':'CL','156':'CN','170':'CO','191':'HR','196':'CY','203':'CZ','208':'DK',
  '218':'EC','231':'ET','233':'EE','246':'FI','250':'FR','276':'DE','288':'GH',
  '300':'GR','320':'GT','348':'HU','356':'IN','360':'ID','364':'IR','372':'IE',
  '376':'IL','380':'IT','388':'JM','392':'JP','400':'JO','404':'KE','410':'KR',
  '414':'KW','428':'LV','440':'LT','442':'LU','458':'MY','470':'MT','484':'MX',
  '504':'MA','524':'NP','528':'NL','554':'NZ','566':'NG','578':'NO','586':'PK',
  '591':'PA','604':'PE','608':'PH','616':'PL','620':'PT','634':'QA','642':'RO',
  '643':'RU','682':'SA','703':'SK','705':'SI','710':'ZA','716':'ZW','724':'ES',
  '752':'SE','756':'CH','764':'TH','784':'AE','792':'TR','804':'UA','818':'EG',
  '826':'GB','840':'US','858':'UY','862':'VE','704':'VN','887':'YE',
  '031':'AZ','051':'AM','070':'BA','112':'BY','116':'KH','158':'TW','188':'CR',
  '214':'DO','268':'GE','340':'HN','398':'KZ','417':'KG','496':'MN','498':'MD',
  '499':'ME','562':'NE','600':'PY','688':'RS','694':'SL','706':'SO','728':'SS',
  '748':'SZ','760':'SY','800':'UG','807':'MK','860':'UZ','894':'ZM',
  '702':'SG','344':'HK',
};

const NUM_TO_NAME: Record<string, string> = {
  '004':'Afghanistan','008':'Albania','012':'Algeria','024':'Angola','032':'Argentina',
  '036':'Australia','040':'Austria','050':'Bangladesh','056':'Belgio','068':'Bolivia',
  '076':'Brasile','100':'Bulgaria','124':'Canada','144':'Sri Lanka','152':'Cile',
  '156':'Cina','170':'Colombia','191':'Croazia','196':'Cipro','203':'Rep. Ceca',
  '208':'Danimarca','218':'Ecuador','233':'Estonia','246':'Finlandia','250':'Francia',
  '276':'Germania','288':'Ghana','300':'Grecia','320':'Guatemala','348':'Ungheria',
  '356':'India','360':'Indonesia','364':'Iran','372':'Irlanda','376':'Israele',
  '380':'Italia','392':'Giappone','400':'Giordania','404':'Kenya','410':'Corea del Sud',
  '414':'Kuwait','428':'Lettonia','440':'Lituania','442':'Lussemburgo','458':'Malaysia',
  '470':'Malta','484':'Messico','504':'Marocco','524':'Nepal','528':'Paesi Bassi',
  '554':'Nuova Zelanda','566':'Nigeria','578':'Norvegia','586':'Pakistan','604':'Perù',
  '608':'Filippine','616':'Polonia','620':'Portogallo','634':'Qatar','642':'Romania',
  '643':'Russia','682':'Arabia Saudita','703':'Slovacchia','705':'Slovenia',
  '710':'Sudafrica','724':'Spagna','752':'Svezia','756':'Svizzera','764':'Tailandia',
  '784':'Emirati Arabi','792':'Turchia','804':'Ucraina','818':'Egitto',
  '826':'Regno Unito','840':'Stati Uniti','858':'Uruguay','862':'Venezuela',
  '704':'Vietnam','716':'Zimbabwe','702':'Singapore','344':'Hong Kong',
  '070':'Bosnia Erzegovina','807':'Macedonia del Nord','499':'Montenegro','688':'Serbia',
  '112':'Bielorussia','268':'Georgia','398':'Kazakistan','051':'Armenia','031':'Azerbaigian',
};

const NAME_TO_A2: Record<string, string> = {
  'Italia':'IT','Italy':'IT','Italie':'IT',
  'Francia':'FR','France':'FR',
  'Germania':'DE','Germany':'DE','Deutschland':'DE',
  'Spagna':'ES','Spain':'ES','España':'ES',
  'Regno Unito':'GB','United Kingdom':'GB','UK':'GB','Gran Bretagna':'GB',
  'Stati Uniti':'US','United States':'US','USA':'US','United States of America':'US',
  'Svizzera':'CH','Switzerland':'CH','Suisse':'CH',
  'Paesi Bassi':'NL','Netherlands':'NL','Olanda':'NL','Holland':'NL',
  'Belgio':'BE','Belgium':'BE',
  'Austria':'AT',
  'Portogallo':'PT','Portugal':'PT',
  'Svezia':'SE','Sweden':'SE',
  'Norvegia':'NO','Norway':'NO',
  'Danimarca':'DK','Denmark':'DK',
  'Finlandia':'FI','Finland':'FI',
  'Polonia':'PL','Poland':'PL',
  'Repubblica Ceca':'CZ','Rep. Ceca':'CZ','Czech Republic':'CZ','Czechia':'CZ',
  'Ungheria':'HU','Hungary':'HU',
  'Romania':'RO',
  'Grecia':'GR','Greece':'GR',
  'Croazia':'HR','Croatia':'HR',
  'Slovenia':'SI',
  'Slovacchia':'SK','Slovakia':'SK',
  'Bulgaria':'BG',
  'Serbia':'RS',
  'Ucraina':'UA','Ukraine':'UA',
  'Russia':'RU',
  'Turchia':'TR','Turkey':'TR',
  'Giappone':'JP','Japan':'JP',
  'Cina':'CN','China':'CN',
  'Corea del Sud':'KR','South Korea':'KR',
  'India':'IN',
  'Australia':'AU',
  'Canada':'CA',
  'Brasile':'BR','Brazil':'BR',
  'Messico':'MX','Mexico':'MX',
  'Argentina':'AR',
  'Sudafrica':'ZA','Sud Africa':'ZA','South Africa':'ZA',
  'Emirati Arabi Uniti':'AE','Emirati Arabi':'AE','United Arab Emirates':'AE','UAE':'AE',
  'Arabia Saudita':'SA','Saudi Arabia':'SA',
  'Israele':'IL','Israel':'IL',
  'Lussemburgo':'LU','Luxembourg':'LU',
  'Irlanda':'IE','Ireland':'IE',
  'Malta':'MT',
  'Cipro':'CY','Cyprus':'CY',
  'Estonia':'EE',
  'Lettonia':'LV','Latvia':'LV',
  'Lituania':'LT','Lithuania':'LT',
  'Singapore':'SG',
  'Malaysia':'MY',
  'Nuova Zelanda':'NZ','New Zealand':'NZ',
  'Marocco':'MA','Morocco':'MA',
};

// ─── Expanded city coordinates ─────────────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  // ── Italy (comprehensive) ──────────────────────────────────────────────
  'Roma':[12.4964,41.9028],'Rome':[12.4964,41.9028],
  'Milano':[9.1900,45.4654],'Milan':[9.1900,45.4654],
  'Napoli':[14.2681,40.8518],'Naples':[14.2681,40.8518],
  'Torino':[7.6869,45.0703],'Turin':[7.6869,45.0703],
  'Firenze':[11.2558,43.7696],'Florence':[11.2558,43.7696],
  'Venezia':[12.3155,45.4408],'Venice':[12.3155,45.4408],
  'Genova':[8.9463,44.4056],'Genoa':[8.9463,44.4056],
  'Bologna':[11.3426,44.4949],
  'Palermo':[13.3614,38.1157],
  'Bari':[16.8719,41.1177],
  'Catania':[15.0873,37.5023],
  'Verona':[10.9916,45.4384],
  'Padova':[11.8768,45.4064],'Padua':[11.8768,45.4064],
  'Trieste':[13.7681,45.6496],
  'Brescia':[10.2118,45.5416],
  'Bergamo':[9.6773,45.6983],
  'Perugia':[12.3887,43.1122],
  'Ancona':[13.5189,43.6158],
  'Messina':[15.5522,38.1938],
  'Modena':[10.9252,44.6471],
  'Reggio Calabria':[15.6500,38.1100],
  'Prato':[11.0919,43.8777],
  'Parma':[10.3279,44.8015],
  'Taranto':[17.2440,40.4760],
  'Cagliari':[9.1100,39.2238],
  'Livorno':[10.3109,43.5485],
  'Foggia':[15.5447,41.4621],
  'Reggio Emilia':[10.6313,44.6989],
  'Ravenna':[12.1986,44.4184],
  'Rimini':[12.5674,44.0678],
  'Salerno':[14.7594,40.6824],
  'Ferrara':[11.6194,44.8381],
  'Sassari':[8.5590,40.7261],
  'Lecce':[18.1739,40.3536],
  'Monza':[9.2736,45.5845],
  'Pescara':[14.2132,42.4618],
  'Trento':[11.1217,46.0748],
  'Vicenza':[11.5354,45.5455],
  'Forlì':[12.0408,44.2227],
  'Bolzano':[11.3548,46.4983],
  'Siena':[11.3297,43.3186],
  'Pisa':[10.4036,43.7228],
  'Latina':[12.8620,41.4677],
  'Udine':[13.2306,46.0748],
  'La Spezia':[9.8239,44.1024],
  'Lucca':[10.5003,43.8429],
  'Andria':[16.2960,41.2280],
  'Terni':[12.6469,42.5634],
  'Novara':[8.6181,45.4493],
  'Piacenza':[9.6964,45.0526],
  'Arezzo':[11.8802,43.4636],
  'Brindisi':[17.9374,40.6426],
  'Varese':[8.8259,45.8206],
  // Ancona already defined above
  'Como':[9.0851,45.8103],
  'Barletta':[16.2776,41.3146],
  'Cosenza':[16.2594,39.2910],
  'Torre del Greco':[14.3595,40.7858],
  // Bergamo already defined above
  'Busto Arsizio':[8.8510,45.6092],
  'Gela':[14.2578,37.0746],
  'Legnano':[8.9143,45.5958],
  'Sesto San Giovanni':[9.2272,45.5324],
  'Guidonia Montecelio':[12.7253,41.9923],
  'Casoria':[14.2930,40.8997],
  'Fiumicino':[12.2344,41.7755],
  'Altamura':[16.5540,40.8277],
  'Cinisello Balsamo':[9.2175,45.5588],
  'Crotone':[17.1268,39.0808],
  'Vittoria':[14.5319,36.9533],
  'Marsala':[12.4356,37.7989],
  'Pozzuoli':[14.0867,40.8217],
  'Trezzano sul Naviglio':[9.0636,45.4218],
  'Aprilia':[12.6551,41.5972],
  'Vigevano':[8.8596,45.3175],
  'Treviso':[12.2427,45.6669],
  // Udine already defined above
  // Grosseto already defined above
  'Mantova':[10.7926,45.1564],
  'Cremona':[10.0230,45.1336],
  'Teramo':[13.7036,42.6589],
  'Potenza':[15.8052,40.6411],
  'Matera':[16.6027,40.6668],
  'Vibo Valentia':[16.1027,38.6765],
  'Caltanissetta':[14.0488,37.4907],
  'Agrigento':[13.5765,37.3108],
  'Trapani':[12.5362,38.0175],
  'Ragusa':[14.7390,36.9266],
  'Enna':[14.2769,37.5664],
  'Nuoro':[9.3300,40.3212],
  'Oristano':[8.5905,39.9001],
  'Lamezia Terme':[16.3075,38.9698],
  'Reggio nell\'Emilia':[10.6313,44.6989],
  'Cesena':[12.2430,44.1291],
  'Imola':[11.7138,44.3536],
  'Faenza':[11.8832,44.2901],
  'Carpi':[10.8838,44.7834],
  'Mirandola':[11.0651,44.8817],
  'Sassuolo':[10.7866,44.5446],
  'Sanremo':[7.7772,43.8143],
  'Imperia':[8.0277,43.8890],
  'Savona':[8.4807,44.3071],
  'Asti':[8.2062,44.9001],
  'Alba':[8.0342,44.6998],
  'Alessandria':[8.6152,44.9143],
  'Cuneo':[7.5458,44.3862],
  'Vercelli':[8.4246,45.3229],
  'Biella':[8.0534,45.5666],
  'Verbania':[8.5571,45.9211],
  'Ivrea':[7.8700,45.4667],
  'Pinerolo':[7.3533,44.8868],
  'Chivasso':[7.8930,45.1912],
  'Nichelino':[7.6490,44.9967],
  'Moncalieri':[7.6858,45.0011],
  'Settimo Torinese':[7.7701,45.1367],
  'Collegno':[7.5784,45.0797],
  'Grugliasco':[7.5762,45.0630],
  'Venaria Reale':[7.6278,45.1173],
  'Sesto Fiorentino':[11.2006,43.8383],
  'Empoli':[10.9465,43.7221],
  'Pistoia':[10.9027,43.9330],
  'Massa':[10.1389,44.0319],
  'Carrara':[10.0996,44.0797],
  'Pietrasanta':[10.2302,43.9602],
  'Viareggio':[10.2524,43.8673],
  'Pontedera':[10.6355,43.6611],
  // Pisa, Grosseto, Terni already defined above
  'Follonica':[10.7620,42.9226],
  'Foligno':[12.7026,42.9559],
  'Spoleto':[12.7383,42.7348],
  'Civitavecchia':[11.7988,42.0932],
  'Velletri':[12.7783,41.6843],
  'Frosinone':[13.3459,41.6400],
  'Cassino':[13.8298,41.4924],
  'Viterbo':[12.1044,42.4169],
  'Rieti':[12.8556,42.4047],
  'Avezzano':[13.4267,42.0283],
  'L\'Aquila':[13.3986,42.3498],
  'Lanciano':[14.3900,42.2277],
  'Chieti':[14.1685,42.3499],
  'Benevento':[14.7683,41.1299],
  'Avellino':[14.7960,40.9140],
  'Caserta':[14.3326,41.0751],
  'Battipaglia':[14.9764,40.6080],
  'Ercolano':[14.3487,40.8072],
  'Pompei':[14.4994,40.7493],
  'Sorrento':[14.3775,40.6262],
  'Amalfi':[14.6024,40.6340],
  'Paola':[16.0446,39.3603],
  'Sibari':[16.4757,39.7562],
  'Gioia Tauro':[15.8987,38.4239],
  'Reggio di Calabria':[15.6500,38.1100],
  'Catanzaro':[16.5880,38.9097],
  // ── France ─────────────────────────────────────────────────────────────
  'Paris':[2.3522,48.8566],'Parigi':[2.3522,48.8566],
  'Lyon':[4.8357,45.7640],'Lione':[4.8357,45.7640],
  'Marseille':[5.3698,43.2965],'Marsiglia':[5.3698,43.2965],
  'Nice':[7.2620,43.7102],'Nizza':[7.2620,43.7102],
  'Bordeaux':[-0.5792,44.8378],
  'Toulouse':[1.4442,43.6047],
  'Strasbourg':[7.7521,48.5734],
  'Montpellier':[3.8767,43.6108],
  'Nantes':[-1.5534,47.2184],
  'Lille':[3.0573,50.6292],
  'Rennes':[-1.6778,48.1173],
  'Reims':[4.0317,49.2583],
  'Saint-Étienne':[4.3872,45.4347],
  'Toulon':[5.9280,43.1242],
  'Grenoble':[5.7245,45.1885],
  'Dijon':[5.0415,47.3220],
  'Angers':[-0.5518,47.4784],
  'Villeurbanne':[4.8879,45.7676],
  'Cannes':[7.0122,43.5528],
  'Monaco':[7.4167,43.7333],
  // ── Germany ────────────────────────────────────────────────────────────
  'Berlin':[13.4050,52.5200],'Berlino':[13.4050,52.5200],
  'Munich':[11.5820,48.1351],'München':[11.5820,48.1351],
  'Hamburg':[9.9937,53.5753],'Amburgo':[9.9937,53.5753],
  'Frankfurt':[8.6821,50.1109],'Francoforte':[8.6821,50.1109],
  'Cologne':[6.9603,50.9333],'Köln':[6.9603,50.9333],
  'Düsseldorf':[6.7734,51.2217],
  'Stuttgart':[9.1829,48.7758],
  'Leipzig':[12.3731,51.3397],
  'Dortmund':[7.4595,51.5136],
  'Essen':[7.0109,51.4556],
  'Bremen':[8.8017,53.0793],
  'Dresden':[13.7372,51.0504],
  'Hannover':[9.7320,52.3759],
  'Nuremberg':[11.0767,49.4521],'Nürnberg':[11.0767,49.4521],
  'Duisburg':[6.7624,51.4344],
  'Bochum':[7.2294,51.4818],
  'Wuppertal':[7.1817,51.2562],
  'Bielefeld':[8.5325,52.0302],
  'Bonn':[7.0982,50.7374],
  'Mannheim':[8.4683,49.4875],
  'Karlsruhe':[8.4044,49.0069],
  'Wiesbaden':[8.2417,50.0782],
  'Augsburg':[10.8978,48.3705],
  'Münster':[7.6261,51.9607],
  'Freiburg':[7.8522,47.9990],
  'Kiel':[10.1325,54.3233],
  'Aachen':[6.0838,50.7753],
  'Lübeck':[10.6864,53.8655],
  // ── Spain ──────────────────────────────────────────────────────────────
  'Madrid':[-3.7038,40.4168],
  'Barcelona':[2.1734,41.3851],'Barcellona':[2.1734,41.3851],
  'Valencia':[-0.3763,39.4699],
  'Seville':[-5.9845,37.3891],'Siviglia':[-5.9845,37.3891],'Sevilla':[-5.9845,37.3891],
  'Zaragoza':[-0.8773,41.6488],
  'Málaga':[-4.4213,36.7213],
  'Murcia':[-1.1302,37.9834],
  'Palma':[2.6502,39.5696],
  'Las Palmas':[-15.4097,28.0997],
  'Bilbao':[-2.9353,43.2630],
  'Alicante':[-0.4887,38.3460],
  'Córdoba':[-4.7794,37.8882],
  'Valladolid':[-4.7278,41.6523],
  'Vigo':[-8.7207,42.2328],
  'Gijón':[-5.6611,43.5322],
  'Granada':[-3.5986,37.1761],
  // ── UK ─────────────────────────────────────────────────────────────────
  'London':[-0.1276,51.5074],'Londra':[-0.1276,51.5074],
  'Manchester':[-2.2426,53.4808],
  'Birmingham':[-1.8904,52.4862],
  'Edinburgh':[-3.1883,55.9533],
  'Glasgow':[-4.2518,55.8642],
  'Liverpool':[-2.9916,53.4084],
  'Leeds':[-1.5491,53.8008],
  'Sheffield':[-1.4701,53.3811],
  'Bristol':[-2.5879,51.4545],
  'Cardiff':[-3.1791,51.4816],
  'Leicester':[-1.1309,52.6369],
  'Nottingham':[-1.1397,52.9548],
  'Southampton':[-1.4044,50.9097],
  'Newcastle':[-1.6162,54.9783],
  'Brighton':[-0.1420,50.8225],
  'Oxford':[-1.2577,51.7520],
  'Cambridge':[0.1218,52.2053],
  'York':[-1.0827,53.9590],
  'Bath':[-2.3597,51.3758],
  // ── Netherlands ────────────────────────────────────────────────────────
  'Amsterdam':[4.9041,52.3676],
  'Rotterdam':[4.4777,51.9244],
  'The Hague':[4.3007,52.0705],'Den Haag':[4.3007,52.0705],
  'Utrecht':[5.1214,52.0907],
  'Eindhoven':[5.4697,51.4416],
  'Groningen':[6.5665,53.2194],
  'Tilburg':[5.0913,51.5555],
  'Almere':[5.2647,52.3508],
  'Breda':[4.7768,51.5719],
  // ── Belgium ────────────────────────────────────────────────────────────
  'Brussels':[4.3517,50.8503],'Bruxelles':[4.3517,50.8503],'Brussel':[4.3517,50.8503],
  'Antwerp':[4.4025,51.2194],'Anversa':[4.4025,51.2194],'Antwerpen':[4.4025,51.2194],
  'Ghent':[3.7174,51.0543],'Gent':[3.7174,51.0543],
  'Bruges':[3.2247,51.2093],'Brugge':[3.2247,51.2093],
  'Liège':[5.5797,50.6326],
  // ── Switzerland ────────────────────────────────────────────────────────
  'Zurich':[8.5417,47.3769],'Zurigo':[8.5417,47.3769],'Zürich':[8.5417,47.3769],
  'Geneva':[6.1432,46.2044],'Ginevra':[6.1432,46.2044],'Genève':[6.1432,46.2044],
  'Basel':[7.5886,47.5596],'Basilea':[7.5886,47.5596],
  'Bern':[7.4474,46.9480],
  'Lausanne':[6.6322,46.5197],
  'Lugano':[8.9511,46.0037],
  'Lucerne':[8.3093,47.0502],'Luzern':[8.3093,47.0502],
  'St. Gallen':[9.3748,47.4245],
  'Winterthur':[8.7269,47.5001],
  // ── Austria ────────────────────────────────────────────────────────────
  'Vienna':[16.3738,48.2082],'Wien':[16.3738,48.2082],
  'Graz':[15.4395,47.0707],
  'Linz':[14.2858,48.3069],
  'Salzburg':[13.0550,47.8095],
  'Innsbruck':[11.4041,47.2692],
  // ── Portugal ───────────────────────────────────────────────────────────
  'Lisbon':[-9.1393,38.7223],'Lisbona':[-9.1393,38.7223],'Lisboa':[-9.1393,38.7223],
  'Porto':[-8.6291,41.1579],
  'Braga':[-8.4260,41.5510],
  'Coimbra':[-8.4291,40.2033],
  'Faro':[-7.9304,37.0194],
  // ── Sweden ─────────────────────────────────────────────────────────────
  'Stockholm':[18.0686,59.3293],
  'Gothenburg':[11.9746,57.7089],'Göteborg':[11.9746,57.7089],
  'Malmö':[13.0038,55.6050],
  'Uppsala':[17.6389,59.8586],
  // ── Norway ─────────────────────────────────────────────────────────────
  'Oslo':[10.7522,59.9139],
  'Bergen':[5.3221,60.3913],
  'Trondheim':[10.3951,63.4305],
  // ── Denmark ────────────────────────────────────────────────────────────
  'Copenhagen':[12.5683,55.6761],'Copenaghen':[12.5683,55.6761],'København':[12.5683,55.6761],
  'Aarhus':[10.2039,56.1629],
  // ── Finland ────────────────────────────────────────────────────────────
  'Helsinki':[24.9384,60.1699],
  'Tampere':[23.7871,61.4978],
  'Turku':[22.2666,60.4518],
  // ── Poland ─────────────────────────────────────────────────────────────
  'Warsaw':[21.0122,52.2297],'Varsavia':[21.0122,52.2297],'Warszawa':[21.0122,52.2297],
  'Krakow':[19.9449,50.0647],'Kraków':[19.9449,50.0647],'Cracovia':[19.9449,50.0647],
  'Wroclaw':[17.0385,51.1079],'Wrocław':[17.0385,51.1079],
  'Poznan':[16.9252,52.4064],'Poznań':[16.9252,52.4064],
  'Gdansk':[18.6466,54.3520],'Gdańsk':[18.6466,54.3520],
  'Lodz':[19.4560,51.7592],'Łódź':[19.4560,51.7592],
  // ── Czech Republic ─────────────────────────────────────────────────────
  'Prague':[14.4378,50.0755],'Praga':[14.4378,50.0755],'Praha':[14.4378,50.0755],
  'Brno':[16.6068,49.1951],
  'Ostrava':[18.2919,49.8209],
  // ── Hungary ────────────────────────────────────────────────────────────
  'Budapest':[19.0402,47.4979],
  'Debrecen':[21.6244,47.5316],
  // ── Romania ────────────────────────────────────────────────────────────
  'Bucharest':[26.1025,44.4268],'Bucarest':[26.1025,44.4268],'București':[26.1025,44.4268],
  'Cluj-Napoca':[23.5941,46.7712],
  'Timișoara':[21.2087,45.7489],
  // ── Greece ─────────────────────────────────────────────────────────────
  'Athens':[23.7275,37.9838],'Atene':[23.7275,37.9838],'Athina':[23.7275,37.9838],
  'Thessaloniki':[22.9444,40.6401],
  // ── Croatia ────────────────────────────────────────────────────────────
  'Zagreb':[15.9819,45.8150],
  'Split':[16.4402,43.5081],
  'Dubrovnik':[18.0944,42.6507],
  // ── Other EU ───────────────────────────────────────────────────────────
  'Luxembourg':[6.1296,49.8153],'Lussemburgo':[6.1296,49.8153],
  'Dublin':[-6.2603,53.3498],'Dublino':[-6.2603,53.3498],
  'Valletta':[14.5146,35.8989],'La Valletta':[14.5146,35.8989],
  'Nicosia':[33.3823,35.1856],
  'Tallinn':[24.7536,59.4370],
  'Riga':[24.1052,56.9496],
  'Vilnius':[25.2799,54.6872],
  'Ljubljana':[14.5058,46.0569],
  'Bratislava':[17.1077,48.1486],
  'Sofia':[23.3219,42.6977],
  'Skopje':[21.4312,41.9981],
  'Podgorica':[19.2636,42.4304],
  'Sarajevo':[18.4131,43.8563],
  'Belgrade':[20.4612,44.8048],'Belgrado':[20.4612,44.8048],
  'Tirana':[19.8189,41.3275],
  'Kyiv':[30.5238,50.4501],'Kiev':[30.5238,50.4501],
  // ── US ─────────────────────────────────────────────────────────────────
  'New York':[-74.0060,40.7128],'New York City':[-74.0060,40.7128],
  'Los Angeles':[-118.2437,34.0522],
  'Chicago':[-87.6298,41.8781],
  'Miami':[-80.1918,25.7617],
  'San Francisco':[-122.4194,37.7749],
  'Seattle':[-122.3321,47.6062],
  'Boston':[-71.0589,42.3601],
  'Houston':[-95.3698,29.7604],
  'Phoenix':[-112.0740,33.4484],
  'Philadelphia':[-75.1652,39.9526],
  'San Antonio':[-98.4936,29.4241],
  'San Diego':[-117.1611,32.7157],
  'Dallas':[-96.7970,32.7767],
  'Denver':[-104.9903,39.7392],
  'Washington':[-77.0369,38.9072],
  'Nashville':[-86.7816,36.1627],
  'Portland':[-122.6765,45.5231],
  'Las Vegas':[-115.1398,36.1699],
  'Austin':[-97.7431,30.2672],
  'Atlanta':[-84.3880,33.7490],
  // ── Canada ─────────────────────────────────────────────────────────────
  'Toronto':[-79.3832,43.6532],
  'Montreal':[-73.5673,45.5017],
  'Vancouver':[-123.1207,49.2827],
  'Calgary':[-114.0719,51.0447],
  'Ottawa':[-75.6972,45.4215],
  // ── Others ─────────────────────────────────────────────────────────────
  'Dubai':[55.2708,25.2048],
  'Abu Dhabi':[54.3773,24.4539],
  'Tokyo':[139.6917,35.6895],
  'Osaka':[135.5022,34.6937],
  'Sydney':[151.2093,-33.8688],
  'Melbourne':[144.9631,-37.8136],
  'Singapore':[103.8198,1.3521],
  'Hong Kong':[114.1694,22.3193],
  'Seoul':[126.9780,37.5665],
  'Bangkok':[100.5018,13.7563],
  'Mumbai':[72.8777,19.0760],
  'New Delhi':[77.2090,28.6139],
  'São Paulo':[-46.6333,-23.5505],
  'Buenos Aires':[-58.3816,-34.6037],
  'Mexico City':[-99.1332,19.4326],
  'Cape Town':[18.4241,-33.9249],
  'Tel Aviv':[34.7818,32.0853],
  'Beirut':[35.5018,33.8938],
  'Istanbul':[28.9784,41.0082],
  'Cairo':[31.2357,30.0444],
  'Casablanca':[-7.5898,33.5731],
  'Nairobi':[36.8219,-1.2921],
};

// ─── Color helpers ────────────────────────────────────────────────────────────
function salesColor(t: number): string {
  if (t <= 0) return 'hsl(220,18%,11%)';
  const h = 210 - t * 25;
  const s = 55 + t * 40;
  const l = 22 + t * 42;
  return `hsl(${h},${s}%,${l}%)`;
}

function cityColor(t: number): string {
  if (t <= 0) return 'hsl(38,96%,55%)';
  const l = 55 + t * 20;
  return `hsl(38,${96}%,${l}%)`;
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

interface CountryData { iso: string; name: string; sales: number; orders: number }
interface CityData { city: string; province: string; country: string; iso: string; sales: number; orders: number; coords?: [number, number] }
interface TooltipState { x: number; y: number; content: React.ReactNode }

interface B2CSalesHeatmapProps {
  orders: Order[];
  dateRange: { start: Date; end: Date };
}

export function B2CSalesHeatmap({ orders, dateRange }: B2CSalesHeatmapProps) {
  const [position, setPosition] = useState<{ zoom: number; coordinates: [number, number] }>({
    zoom: 1.4,
    coordinates: [13, 46],
  });
  const [selectedSku, setSelectedSku] = useState<string>('all');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const skuOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.filter(o => o.customerType === 'B2C').forEach(o =>
      o.products.forEach(p => { if (!map.has(p.sku)) map.set(p.sku, p.name || p.sku); })
    );
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);

  const { salesByIso, maxSales, cityData, topCities, maxCitySales } = useMemo(() => {
    const byIso: Record<string, CountryData> = {};
    const byCity: Record<string, CityData> = {};

    orders.filter(o => o.customerType === 'B2C').forEach(o => {
      let amount: number;
      const orderNet = o.netAmount ?? o.totalAmount;
      if (selectedSku === 'all') {
        amount = orderNet;
      } else {
        const prod = o.products.find(p => p.sku === selectedSku);
        if (!prod) return;
        // Distribute order-level net proportionally to this SKU's share of gross items
        const itemsGross = o.products.reduce((s, p) => s + p.totalPrice, 0);
        amount = itemsGross > 0 ? orderNet * (prod.totalPrice / itemsGross) : 0;
      }
      if (amount <= 0) return;

      const rawCountry = o.destinationCountry || o.country || '';
      const iso = NAME_TO_A2[rawCountry] || (rawCountry.length === 2 ? rawCountry.toUpperCase() : '');
      if (!iso) return;

      if (!byIso[iso]) byIso[iso] = { iso, name: rawCountry, sales: 0, orders: 0 };
      byIso[iso].sales += amount;
      byIso[iso].orders++;

      const city = (o.destinationCity || '').trim();
      if (city) {
        const key = `${iso}:${city}`;
        if (!byCity[key]) {
          const coords = CITY_COORDS[city] as [number, number] | undefined;
          byCity[key] = { city, province: o.destinationProvince || '', country: rawCountry, iso, sales: 0, orders: 0, coords };
        }
        byCity[key].sales += amount;
        byCity[key].orders++;
      }
    });

    const maxSales = Math.max(...Object.values(byIso).map(v => v.sales), 1);
    const allCities = Object.values(byCity).sort((a, b) => b.sales - a.sales);
    const maxCitySales = Math.max(...allCities.map(c => c.sales), 1);
    const topCities = allCities.slice(0, 15);
    const cityData = allCities.filter(c => c.coords);

    return { salesByIso: byIso, maxSales, cityData, topCities, maxCitySales };
  }, [orders, selectedSku]);

  const showTooltip = useCallback((e: React.MouseEvent, content: React.ReactNode) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content });
  }, []);

  const moveTooltip = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !tooltip) return;
    setTooltip(t => t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
  }, [tooltip]);

  const handleZoomIn = () => setPosition(p => ({ ...p, zoom: Math.min(p.zoom * 1.5, 12) }));
  const handleZoomOut = () => setPosition(p => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) }));
  const handleReset = () => setPosition({ zoom: 1.4, coordinates: [13, 46] });

  const zoomToCity = (city: CityData) => {
    if (!city.coords) return;
    setPosition({ zoom: 6, coordinates: city.coords });
    setActiveCity(`${city.iso}:${city.city}`);
  };

  const periodLabel = `${format(dateRange.start, 'dd MMM', { locale: enUS })} – ${format(dateRange.end, 'dd MMM yyyy', { locale: enUS })}`;
  const totalB2CSales = Object.values(salesByIso).reduce((s, c) => s + c.sales, 0);

  return (
    <div className="chart-container space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">B2C Sales Map</h3>
            <span className="badge-b2c text-[10px] font-bold px-2 py-0.5 rounded-full">B2C</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{periodLabel} · {fmtCurrency(totalB2CSales)} total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2 py-1">
            <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
            <select
              value={selectedSku}
              onChange={e => setSelectedSku(e.target.value)}
              className="bg-transparent text-xs text-foreground outline-none cursor-pointer max-w-[200px]"
            >
              <option value="all">All products</option>
              {skuOptions.map(([sku, name]) => (
                <option key={sku} value={sku}>{sku} — {name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            {[
              { icon: <ZoomIn className="w-3.5 h-3.5" />, fn: handleZoomIn, title: 'Zoom in' },
              { icon: <ZoomOut className="w-3.5 h-3.5" />, fn: handleZoomOut, title: 'Zoom out' },
              { icon: <RotateCcw className="w-3.5 h-3.5" />, fn: handleReset, title: 'Reset' },
            ].map(({ icon, fn, title }) => (
              <button key={title} onClick={fn} title={title}
                className="p-1.5 rounded-md border border-border/40 bg-muted/40 hover:bg-muted text-foreground transition-colors">
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map + city panel */}
      <div className="flex gap-3 min-h-0">
        {/* Map */}
        <div
          ref={containerRef}
          className="relative flex-1 rounded-xl overflow-hidden border border-border/30"
          style={{ background: 'hsl(222,38%,5%)' }}
          onMouseLeave={() => setTooltip(null)}
        >
          <ComposableMap
            projectionConfig={{ scale: 145, center: [10, 20] }}
            style={{ width: '100%', height: 'auto' }}
            height={440}
          >
            <ZoomableGroup
              zoom={position.zoom}
              center={position.coordinates}
              onMoveEnd={({ zoom, coordinates }) =>
                setPosition({ zoom, coordinates: coordinates as [number, number] })
              }
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const numId = String(geo.id).padStart(3, '0');
                    const iso = NUM_TO_A2[numId] || '';
                    const countryName = NUM_TO_NAME[numId] || iso;
                    const data = salesByIso[iso];
                    const t = data ? data.sales / maxSales : 0;
                    const fill = salesColor(t);
                    const hoverFill = data ? 'hsl(38,90%,52%)' : 'hsl(220,18%,18%)';

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="hsl(220,22%,14%)"
                        strokeWidth={0.35}
                        style={{
                          default: { outline: 'none', transition: 'fill 0.2s ease' },
                          hover: { outline: 'none', fill: hoverFill, cursor: 'pointer', filter: 'brightness(1.15)' },
                          pressed: { outline: 'none' },
                        }}
                        onMouseEnter={e => {
                          showTooltip(e,
                            <div>
                              <p className="font-semibold text-foreground mb-1">{countryName}</p>
                              {data ? (
                                <>
                                  <p className="text-primary font-mono font-bold text-sm">{fmtCurrency(data.sales)}</p>
                                  <p className="text-muted-foreground text-[10px] mt-0.5">{data.orders} {data.orders === 1 ? 'order' : 'orders'}</p>
                                  <p className="text-muted-foreground text-[10px]">{((data.sales / totalB2CSales) * 100).toFixed(1)}% of total</p>
                                </>
                              ) : (
                                <p className="text-muted-foreground text-[10px]">No sales</p>
                              )}
                            </div>
                          );
                        }}
                        onMouseMove={moveTooltip}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })
                }
              </Geographies>

              {/* City markers — always visible, scaled by zoom */}
              {cityData.map((c, i) => {
                if (!c.coords) return null;
                const t = c.sales / maxCitySales;
                const baseR = Math.max(2.5, Math.min(12, 2.5 + t * 9.5));
                const r = baseR / position.zoom;
                const isActive = activeCity === `${c.iso}:${c.city}`;
                const isTop = i < 5;
                return (
                  <Marker key={`${c.iso}:${c.city}`} coordinates={c.coords}>
                    {isTop && (
                      <circle
                        r={r * 2.2}
                        fill={cityColor(t)}
                        fillOpacity={0.15}
                        stroke="none"
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                    <circle
                      r={r}
                      fill={isActive ? 'hsl(38,100%,68%)' : cityColor(t)}
                      fillOpacity={isActive ? 1 : 0.9}
                      stroke={isActive ? 'white' : 'hsl(222,35%,6%)'}
                      strokeWidth={(isActive ? 1.5 : 0.6) / position.zoom}
                      style={{ cursor: 'pointer', transition: 'fill 0.15s ease' }}
                      onMouseEnter={e => {
                        showTooltip(e as unknown as React.MouseEvent,
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <MapPin className="w-3 h-3 text-amber-400" />
                              <p className="font-semibold text-foreground">{c.city}</p>
                            </div>
                            {c.province && <p className="text-muted-foreground text-[10px] mb-1">{c.province} · {c.country}</p>}
                            <p className="text-amber-400 font-mono font-bold text-sm">{fmtCurrency(c.sales)}</p>
                            <p className="text-muted-foreground text-[10px] mt-0.5">{c.orders} {c.orders === 1 ? 'order' : 'orders'}</p>
                            <p className="text-muted-foreground text-[10px]">{((c.sales / totalB2CSales) * 100).toFixed(1)}% of total</p>
                          </div>
                        );
                      }}
                      onMouseMove={e => moveTooltip(e as unknown as React.MouseEvent)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute pointer-events-none z-50 px-3 py-2.5 rounded-xl shadow-2xl text-xs"
              style={{
                left: Math.min(tooltip.x + 14, (containerRef.current?.offsetWidth ?? 400) - 180),
                top: Math.max(tooltip.y - 80, 8),
                background: 'hsl(222,32%,9%)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
                maxWidth: 200,
              }}
            >
              {tooltip.content}
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-2 left-3 flex items-center gap-2">
            <div className="flex gap-px rounded overflow-hidden">
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map(v => (
                <div key={v} className="w-5 h-2" style={{ backgroundColor: salesColor(v) }} />
              ))}
            </div>
            <span className="text-[9px] text-muted-foreground/60">low → high</span>
          </div>

          <p className="absolute bottom-2 right-3 text-[9px] text-muted-foreground/40 select-none">
            scroll/pinch · drag
          </p>
        </div>

        {/* Top cities panel */}
        {topCities.length > 0 && (
          <div className="w-52 shrink-0 rounded-xl border border-border/30 overflow-hidden"
            style={{ background: 'hsl(220,25%,8%)' }}>
            <div className="px-3 py-2.5 border-b border-border/30">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                Top Cities
              </p>
            </div>
            <div className="overflow-y-auto scrollbar-custom" style={{ maxHeight: 404 }}>
              {topCities.map((c, i) => {
                const t = c.sales / maxCitySales;
                const barW = Math.max(4, Math.round(t * 100));
                const isActive = activeCity === `${c.iso}:${c.city}`;
                return (
                  <button
                    key={`${c.iso}:${c.city}`}
                    onClick={() => { zoomToCity(c); }}
                    className={`w-full text-left px-3 py-2 border-b border-border/20 transition-colors hover:bg-muted/40 ${isActive ? 'bg-muted/60' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] text-muted-foreground/50 font-mono w-3 shrink-0">{i + 1}</span>
                      <span className="text-[11px] font-medium text-foreground truncate flex-1">{c.city}</span>
                    </div>
                    <div className="flex items-center gap-2 pl-5">
                      <div className="flex-1 h-1 rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barW}%`, background: `hsl(38,96%,${50 + t * 15}%)` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-amber-400/90 shrink-0">
                        {fmtCurrency(c.sales)}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/50 pl-5 mt-0.5">{c.orders} ord. · {c.country}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom legend */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-400 opacity-80" />
            <span className="text-[10px] text-muted-foreground">City markers (click to zoom)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: salesColor(0.8) }} />
            <span className="text-[10px] text-muted-foreground">Country intensity</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/50">
          {cityData.length} cities · {Object.keys(salesByIso).length} countries
        </p>
      </div>
    </div>
  );
}
