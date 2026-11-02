// Every AFRO IN ally across the editions: the home section and the allies page share this list.
import type { ImageMetadata } from "astro";
import costenoBeach from "@/assets/img/aliados/clean/costeno-beach-v2.png";
import masaya from "@/assets/img/aliados/masaya.webp";
import laPuerta from "@/assets/img/aliados/la-puerta.webp";
import portalSuenos from "@/assets/img/aliados/clean/portal-de-mis-suenos-v2.png";
import kolaoHouse from "@/assets/img/aliados/clean/kolao-house-v2.png";
import kombilesaMi from "@/assets/img/aliados/kombilesa-mi.webp";
import afroNeto from "@/assets/img/aliados/clean/afro-neto-v2.png";
import afroDanceAcademy from "@/assets/img/aliados/clean/afro-dance-academy-v2.png";
import charlyAfrica from "@/assets/img/aliados/clean/charly-africa-v2.png";
import aliAcademia from "@/assets/img/aliados/clean/ali-academia-v2.png";
import sumarte from "@/assets/img/aliados/clean/sumarte-v2.png";
import caribeamTeam from "@/assets/img/aliados/caribeam-team.webp";
import kfMusic from "@/assets/img/aliados/clean/kf-music-v2.png";
import gCorp from "@/assets/img/aliados/g-corp.webp";
import afroCompany from "@/assets/img/aliados/clean/afro-company-v2.png";
import casaLoma from "@/assets/img/aliados/clean/casa-loma-v2.png";
import culturaIndependiente from "@/assets/img/aliados/clean/cultura-independiente-v2.png";
import dancehallClass from "@/assets/img/aliados/dancehall-class-colombia.jpg";
import djTang from "@/assets/img/aliados/dj-tang-master-sound.jpg";
import fafoman from "@/assets/img/aliados/clean/fafoman-v2.png";
import escenciaAfricana from "@/assets/img/aliados/clean/fundacion-escencia-africana-v2.png";
import masayaTayrona from "@/assets/img/aliados/clean/masaya-tayrona-v2.png";
import republicaHostels from "@/assets/img/aliados/clean/republica-hostels-v2.png";
import tayrosoft from "@/assets/img/aliados/tayrosoft-logo.svg";


// The allies page (dark): each logo with its own colours and a thin white sticker outline.
import onDarkCostenoBeach from "@/assets/img/aliados/ondark/costeno-beach-contorno.png";
import onDarkMasayaTayrona from "@/assets/img/aliados/ondark/masaya-tayrona-contorno.png";
import onDarkPortalDeMisSuenos from "@/assets/img/aliados/ondark/portal-de-mis-suenos-contorno.png";
import onDarkCasaLoma from "@/assets/img/aliados/ondark/casa-loma-contorno.png";
import onDarkRepublicaHostels from "@/assets/img/aliados/ondark/republica-hostels-contorno.png";
import onDarkKolaoHouse from "@/assets/img/aliados/ondark/kolao-house-contorno.png";
import onDarkAfroNeto from "@/assets/img/aliados/ondark/afro-neto-contorno.png";
import onDarkAfroDanceAcademy from "@/assets/img/aliados/ondark/afro-dance-academy-contorno.png";
import onDarkCharlyAfrica from "@/assets/img/aliados/ondark/charly-africa-contorno.png";
import onDarkAfroCompany from "@/assets/img/aliados/ondark/afro-company-contorno.png";
import onDarkDancehallClassColombia from "@/assets/img/aliados/ondark/dancehall-class-colombia-contorno.png";
import onDarkFundacionEscenciaAfricana from "@/assets/img/aliados/ondark/fundacion-escencia-africana-gemini-blanco.png";
import onDarkFafoman from "@/assets/img/aliados/ondark/fafoman-contorno.png";
import onDarkAliAcademia from "@/assets/img/aliados/ondark/ali-academia-contorno.png";
import onDarkSumarte from "@/assets/img/aliados/ondark/sumarte-gemini-contorno.png";
import onDarkCulturaIndependiente from "@/assets/img/aliados/ondark/cultura-independiente-contorno.png";
import onDarkDjTangMasterSound from "@/assets/img/aliados/ondark/dj-tang-master-sound-gemini.png";
import onDarkKfMusic from "@/assets/img/aliados/ondark/kf-music-contorno.png";
import onDarkGCorp from "@/assets/img/aliados/ondark/g-corp-blanco.png";
export interface Ally {
  name: string;
  type: string;
  location: string;
  image: ImageMetadata;
  // Same logo with a white sticker outline, for dark backgrounds.
  imageOnDark?: ImageMetadata;
  // Section on the allies page.
  group: "stay" | "culture" | "dance" | "services";
}

export const allies: Ally[] = [
  // ROW 1: Strong Anchors (Hospitality & Venues)
  {
    name: "Costeno Beach",
    imageOnDark: onDarkCostenoBeach,
    group: "stay",
    type: "Hostal & Surf",
    location: "Santa Marta",
    image: costenoBeach,
  },
  {
    name: "Masaya",
    group: "stay",
    type: "Hostels",
    location: "Santa Marta",
    image: masaya,
  },
  {
    name: "Masaya Tayrona",
    imageOnDark: onDarkMasayaTayrona,
    group: "stay",
    type: "Eco Hostel",
    location: "Tayrona",
    image: masayaTayrona,
  },

  {
    name: "Portal de mis Sueños",
    imageOnDark: onDarkPortalDeMisSuenos,
    group: "culture",
    type: "Espacio Cultural",
    location: "Santa Marta",
    image: portalSuenos,
  },
  {
    name: "Casa Loma",
    imageOnDark: onDarkCasaLoma,
    group: "stay",
    type: "Minca Hostel",
    location: "Minca",
    image: casaLoma,
  },
  {
    name: "Republica Hostels",
    imageOnDark: onDarkRepublicaHostels,
    group: "stay",
    type: "Hostal",
    location: "Santa Marta",
    image: republicaHostels,
  },
  // ROW 2: Cultural Roots (Afro/Palenque)
  {
    name: "Kolao House",
    imageOnDark: onDarkKolaoHouse,
    group: "stay",
    type: "Hospedaje",
    location: "Palenque",
    image: kolaoHouse,
  },
  {
    name: "Kombilesa Mi",
    group: "culture",
    type: "Música & Cultura",
    location: "Palenque",
    image: kombilesaMi,
  },
  {
    name: "Afro Neto",
    imageOnDark: onDarkAfroNeto,
    group: "culture",
    type: "Música & Cultura",
    location: "Palenque",
    image: afroNeto,
  },
  {
    name: "Afro Dance Academy",
    imageOnDark: onDarkAfroDanceAcademy,
    group: "dance",
    type: "Academia",
    location: "Santa Marta",
    image: afroDanceAcademy,
  },
  {
    name: "Charly Africa",
    imageOnDark: onDarkCharlyAfrica,
    group: "dance",
    type: "Dance Studio",
    location: "Santa Marta",
    image: charlyAfrica,
  },
  {
    name: "Afro Company",
    imageOnDark: onDarkAfroCompany,
    group: "culture",
    type: "Cultura & Arte",
    location: "Santa Marta",
    image: afroCompany,
  },
  {
    name: "Dancehall Class Colombia",
    imageOnDark: onDarkDancehallClassColombia,
    group: "dance",
    type: "Escuela de Baile",
    location: "Colombia",
    image: dancehallClass,
  },
  {
    name: "Fundación Escencia Africana",
    imageOnDark: onDarkFundacionEscenciaAfricana,
    group: "culture",
    type: "Fundación",
    location: "Santa Marta",
    image: escenciaAfricana,
  },
  {
    name: "Fafoman",
    imageOnDark: onDarkFafoman,
    group: "culture",
    type: "Artista & Productor",
    location: "Santa Marta",
    image: fafoman,
  },
  // ROW 3: Services & Education
  {
    name: "Ali Academia",
    imageOnDark: onDarkAliAcademia,
    group: "dance",
    type: "Baile & Arte",
    location: "Santa Marta",
    image: aliAcademia,
  },
  {
    name: "Sumarte",
    imageOnDark: onDarkSumarte,
    group: "culture",
    type: "Fundación",
    location: "Santa Marta",
    image: sumarte,
  },
  {
    name: "Cultura Independiente",
    imageOnDark: onDarkCulturaIndependiente,
    group: "culture",
    type: "Plataforma Cultural",
    location: "Colombia",
    image: culturaIndependiente,
  },
  {
    name: "Caribeam Team",
    group: "services",
    type: "Producción",
    location: "Santa Marta",
    image: caribeamTeam,
  },
  {
    name: "DJ Tang Master Sound",
    imageOnDark: onDarkDjTangMasterSound,
    group: "services",
    type: "Productor Musical",
    location: "Santa Marta",
    image: djTang,
  },
  {
    name: "KF Music",
    imageOnDark: onDarkKfMusic,
    group: "services",
    type: "Consultancy",
    location: "Internacional",
    image: kfMusic,
  },
  // ROW 4: Corporate
  {
    name: "G Corp",
    imageOnDark: onDarkGCorp,
    group: "services",
    type: "Corporativo",
    location: "Santa Marta",
    image: gCorp,
  },
  {
    name: "Tayrosoft",
    group: "services",
    type: "Tecnología",
    location: "Santa Marta",
    image: tayrosoft,
  },
  {
    name: "La Puerta",
    group: "stay",
    type: "Bar & Cultural",
    location: "Santa Marta",
    image: laPuerta,
  },
];
