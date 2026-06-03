# ===========================================  
# Informe Mensual de Evaluación de Clientes  
# Descarga Paralela, Procesamiento y Exportación a Excel  
# ===========================================  

import os  # Manejo de rutas y archivos  
import time  # Pausas entre requests  
from datetime import datetime  # Parseo de timestamps  
from dateutil.parser import parse  # Parseo flexible de fechas  
import pandas as pd  # Manipulación de datos  
import ast  # Para literal_eval de Temas/Amenidades  
from tqdm import tqdm  # Barra de progreso  
from outscraper import ApiClient  # Cliente para Outscraper  
from dateutil.relativedelta import relativedelta  # Cálculo de horizontes temporales  
from collections import Counter  # Conteo de frases RAKE  
from concurrent.futures import ThreadPoolExecutor, as_completed  # Paralelización  
import nltk
nltk.download('punkt')        # tokenizador estándar
nltk.download('punkt_tab')
print("librerias instaladas")
# RAKE y stopwords  
import nltk  
nltk.download('stopwords', quiet=True)  
from rake_nltk import Rake  
rake = Rake(language='spanish')  # Extracción automática de keywords  

#Import dotenv para manejo de variables de entorno
from dotenv import load_dotenv

# TextBlob para polaridad  
from textblob import TextBlob 

# Detector de género por nombre  
import gender_guesser.detector as gender_det  
detector = gender_det.Detector(case_sensitive=False) 
    
# Intentar importar traductor automático  
try:  
    from googletrans import Translator  
    translator = Translator()  
except ImportError:  
    translator = None  # Omite traducción si no está disponible  

# -------------------------------------------  
# 1. Configuración de API y proyectos  
# -------------------------------------------  
load_dotenv()  # Carga variables de entorno desde .env
OUTSCRAPER_API_KEY = os.getenv('OUTSCRAPER_API_KEY')
api_client = ApiClient(api_key=OUTSCRAPER_API_KEY)  
if not OUTSCRAPER_API_KEY or 'TU_API_KEY' in OUTSCRAPER_API_KEY:  
    raise ValueError(  
        "La API KEY de Outscraper no está configurada. Por favor reemplaza 'TU_API_KEY_AQUI'."  
    )  

BUILDINGS = [  
    'INSITU Irarrázaval, Santiago, Chile',  
    'INSITU Echaurren, Santiago, Chile',  
    'Somma Plaza Ñuloa, Santiago, Chile',  
    'Somma Inés de Suárez, Santiago, Chile',  
    'Somma Asturias, Santiago, Chile',  
    'Ronda Santo Domingo, Santiago, Chile',  
    'Somma Plaza Bustamante, Santiago, Chile',  
    'Nativo Riesco, Santiago, Chile',  
    'Nomad Holley, Santiago, Chile',  
    'Nomad Bellet, Santiago, Chile',  
    'IMU San Cristóbal, Santiago, Chile',  
    'Spot Nueva Kennedy, Santiago, Chile',  
    'Soho Barrio Italia, Santiago, Chile',  
    'Park Santiago, Santiago, Chile', 
    'The Place, Santiago, Chile'  
]  

# Archivo de salida único  
OUTPUT_XLSX = r"Y:\\4. Estudios de mercado\\2. Informes Power Bi\\MF Star Scrapper\\data\\informe_multifamily.xlsx"


# -------------------------------------------  
# 2. Diccionarios y frases clave  
# -------------------------------------------  
POS_CATS = {
    'Atención del personal': [
        'atencion','atención','personal','administracion','administración','trato','amabilidad','recepcion','recepción','staff','service','support','conserjeria','porteria','gestión',
        'gestora','conserje', 'atencoin','persnal','amblidad','recepsion','conserge','servicio','equipo','profesional'],
    'Diseño/calidad interior': [
        'diseno','diseño','acabados','decoracion','decoración','interior','terminaciones','calidad','comodidad','ambiente','elegante','espacios comunes','lobby','hall','disenio','decpracion',
        'inteior','acabado','comodid','ambientee','infraestructura','bonito','proyecto','edificio','lindo','bello','hermoso','comodo'],
    'Ubicación': [
        'ubicacion','ubicación','localizacion','localización','zona','barrio','vecindario','lugar','cercania','cercanía','acceso','gps','metro','micro','transporte','ubicasion','localisacion',
        'cercaniia','transorte'],
    'Limpieza/mantenimiento': [
        'limpieza','limpio','higiene','mantenimiento','aseo','desinfeccion','desinfección','escoba','orden','basura','limpiesa','mantenimento','aseoo'],
    'Seguridad': [
        'seguridad','seguro','vigilancia','proteccion','protección','camara','cámara','guardia',
        'alarma','cctv','seguriad','inseguro','proteccion','protecion'],
    'Precio/Costo': [
        'costo','caro','valor','precio','arriendo','aumento','subida','costro','pricio','valorr'],
    'Amenities': [
        'amenidades','instalaciones','gimnasio','gym','piscina','terraza','quincho','cowork','lavanderia','salón','sala','jacuzzi','spa','pet friendly','lobby','aminidades','gimsnasio',
        'lavnderia','quinch','áreas comunes','áreas','areas','amenities'],
    'Felicitaciones': [
        'excelente','exelent','encantó','wonderfull','encanta','espectacular','muy bueno','perfect','perfecto'],
    'Otros': []
}
NEG_CATS = {
    'Higiene ambiental': [
        'olor','olores','moho','humedad','suciedad','inundación','sucio','oloor','oloroso','humeda','aseo','aseó'],
    'Mantenciones': [
        'mantencion','mantenimiento','reparacion','reparación','averia','avería','arreglo','falla','mantenimineto','reparar','fajla'],
    'Conectividad': [
        'internet','wifi','conexion','conexión','latencia','corte','señal','fibra','wiffi','wify','net','conecion'],
    'Calefacción': [
        'calefaccion','calefacción','frio','frío','calor','calefaion'],
    'Estacionamiento': [
        'estacionamiento','parking','garaje','cochera','parkin','estacionaminto'],
    'Atención cliente': [
        'telefono','teléfono','email','demora','reclamo','queja','supervisión','atencion','administrado','service''amigable','teléfonoo','telefan','demora', 'administración','administracion','supervisión','atención','atencion'],
    'Garantía': [
        'deposito','depósito','fianza','garantia','garantía','debposito','fianzia'],
    'Cobros': [
        'pago','facturación','cobranza','cobros','reembolso','caro','aumento','subida','cobro','excesivo','cobran','multa','cobrarte'],
    'Ruidos': [
        'ruido','bulla','sonido','noise','tráfico','música','ruiddo','bullla'],
    'Seguridad': [
        'seguridad','seguro','inseguro','robo','hurto','seguriad','roban','robaron','roba'],
    'Crítica': [
        'horrible','peor','terrible','desagradable','pésimo','mala experiencia'],
    'Otros': []
}
POS_PHRASES = [
    'buen ambiente', 'buen servicio', 'trato excelente','excelente ubicación', 'vistas hermosas', 'servicio rápido', 'wifi gratis',
    'gente amable', 'espacios amplios', 'diseño moderno']
NEG_PHRASES = [
    'mala internet', 'sin señal wifi', 'internet lento','mucho ruido', 'ruido nocturno', 'poca limpieza',
    'cobro excesivo', 'demora pago', 'fianza retenida','sin estacionamiento', 'agua fría', 'servicio lento']

AMENITIES = ['gimnasio','piscina','terraza','quincho','cowork','lavanderia','sala de cine','jacuzzi','spa','pet friendly','lobby']

# -------------------------------------------  
# 3. Función de descarga de reseñas (paralela)  
# -------------------------------------------  
def fetch_all_reviews(building_query):
    """Descarga todas las reseñas de un edificio, incluyendo el nombre de usuario."""
    base_name = building_query.split(',')[0].strip().lower()
    query = building_query
    if base_name == 'park santiago':
        query = 'Park Santiago Agencia Inmobiliaria, Santiago, Chile'
    results = api_client.google_maps_reviews(query, reviews_limit=0)
    rows = []
    for place in results:
        reviews = place.get('reviews_data') or place.get('reviews') or []
        for r in reviews:
            text = r.get('review_text', '') or ''
            # Detección de idioma y filtrado
            if translator:
                try:
                    if translator.detect(text).lang != 'es':
                        continue
                except:
                    pass
            # Filtrar menciones al parque
            if base_name == 'park santiago':
                lt = text.lower()
                if 'parque' in lt or ' park ' in f" {lt} ":
                    continue
            # Parseo de fecha flexible
            date_str = (r.get('review_datetime_utc') or r.get('datetime_utc')
                        or r.get('datetime') or r.get('review_timestamp'))
            try:
                fecha = parse(date_str) if date_str else None
            except:
                fecha = None
            # Obtener nombre de usuario (author_name es la clave correcta)
            usuario = (
                r.get('author_title') or
                r.get('author_name') or
                r.get('review_author_name') or
                r.get('name') or
                (r.get('user') or {}).get('name') or
                r.get('user_name') or
                r.get('reviewer_name') or
                ''
            )  
            rows.append({
                'Edificio': base_name,
                'Fecha': fecha,
                'Score': r.get('rating', r.get('review_rating', 0)),
                'Texto': text,
                'Usuario': usuario
            })
    return rows  

# -------------------------------------------  
# 4. Extensión automática de frases RAKE  
# -------------------------------------------  
def extend_phrases_from_otros():  
    try:  
        df_chk = pd.read_csv('data/manual_check.csv')  
    except:  
        return  
    df_chk['Temas'] = df_chk['Temas'].apply(lambda x: ast.literal_eval(x) if isinstance(x,str) else x)  
    df_otros = df_chk[df_chk.apply(lambda r: 'Otros' in r['Temas'] and r['Edificio'].lower()!= 'park santiago', axis=1)]  
    rake_temp = Rake(language='spanish')  
    phrase_counts = Counter()  
    for text in df_otros['Texto'].fillna('').astype(str):  
        rake_temp.extract_keywords_from_text(text.lower())  
        phrase_counts.update(rake_temp.get_ranked_phrases())  
    top_phrases = [p for p,_ in phrase_counts.most_common(10)]  
    for i, p in enumerate(top_phrases):  
        if i % 2 == 0:  
            POS_PHRASES.append(p)  
        else:  
            NEG_PHRASES.append(p)  

extend_phrases_from_otros()  

# -------------------------------------------
# 5. Funciones de sentimiento y clasificación
# -------------------------------------------
def sentiment(text, score):
    """Clasifica por estrellas, polaridad y sin comentario."""
    # 2. Umbrales por estrellas
    if score >= 4:
        return 'Positiva'
    if score <= 2:
        return 'Negativa'
    # 3. Caso 3 estrellas: polaridad
    pol = TextBlob(text or '').sentiment.polarity
    if pol > 0:
        return 'Positiva'
    if pol < 0:
        return 'Negativa'
    # 1. Sin comentario para vacíos o gibberish
    if not text or len(text.strip()) < 5:
        return 'Sin Comentario'
    return 'Neutra'


def classify(text, senti):
    """Extrae temas y amenities, maneja sin comentario."""
    txt = (text or '').lower()
    if not txt or len(txt.strip()) < 5:
        return ['Sin Comentario'], []
    rake.extract_keywords_from_text(txt)
    keywords = set(rake.get_ranked_phrases())
    temas = []
    frases = POS_PHRASES if senti=='Positiva' else NEG_PHRASES
    for phrase in frases:
        if phrase in txt:
            temas.append(phrase)
    cats = POS_CATS if senti=='Positiva' else NEG_CATS if senti=='Negativa' else {}
    for cat, kws in cats.items():
        if any(k in txt or k in keywords for k in kws):
            temas.append(cat)
    return temas or ['Otros'], [a for a in AMENITIES if a in txt]

# -------------------------------------------  
# 6. Descarga paralela de reseñas  
# -------------------------------------------  
def main_descarga():  
    os.makedirs(os.path.dirname(OUTPUT_XLSX), exist_ok=True)  
    all_rows = []  
    with ThreadPoolExecutor(max_workers=5) as executor:  
        futures = {executor.submit(fetch_all_reviews, b): b for b in BUILDINGS}  
        for fut in as_completed(futures):  
            bld = futures[fut]  
            try:  
                all_rows.extend(fut.result())  
            except Exception as e:
                msg = str(e)
                print(f"[ERROR] {bld}")
                print(f"  Tipo : {type(e).__name__}")
                print(f"  Detalle: {msg}")
                if '402' in msg:
                    print("  → Créditos insuficientes o suscripción vencida en Outscraper.")
                elif '401' in msg:
                    print("  → API Key inválida o no autorizada.")
                elif '429' in msg:
                    print("  → Rate limit alcanzado. Espera antes de reintentar.")
                elif '5' in msg[:3]:
                    print("  → Error del servidor de Outscraper. Intenta más tarde.")
    return all_rows  

# -------------------------------------------  
# 7. Análisis, clasificación y exportación único excel  
# -------------------------------------------  
def main_analisis():  
    rows = main_descarga()  
    if not rows:  
        print("No se descargaron reseñas. Verifica tu API Key y conexión.")  
        return  
    df = pd.DataFrame(rows)  

    # Asegurar que Fecha es datetime
    df['Fecha'] = pd.to_datetime(df['Fecha'], errors='coerce')

    # Inferir género a partir del primer nombre  
    df['PrimerNombre'] = df['Usuario'].str.split().str[0].fillna('')  
    df['Sexo'] = df['PrimerNombre'].apply(lambda n: detector.get_gender(n) if n else 'unknown')  

    # Clasificación sentiment y categorization  
    df['Sentimiento'] = df.apply(lambda r: sentiment(r['Texto'], r['Score']), axis=1)  
    df[['Temas','Amenidades']] = df.apply(  
        lambda r: classify(r['Texto'], r['Sentimiento']), axis=1, result_type='expand'  
    )  
    # Métricas vs mes previo  
    mes_ant = datetime.now() - relativedelta(months=1)  
    metrics = []  
    for b, grp in df.groupby('Edificio'):  
        total = len(grp)  
        ca = grp['Score'].mean() if total else 0  
        cp = grp[grp['Fecha'] < mes_ant]['Score'].mean() if total else 0  
        nuevas = grp[grp['Fecha'] >= mes_ant].shape[0]  
        pos_pct = (grp['Sentimiento'] == 'Positiva').mean() * 100 if total else 0  
        neg_pct = (grp['Sentimiento'] == 'Negativa').mean() * 100 if total else 0  
        metrics.append({  
            'Edificio': b,  
            'CalifActual': ca,  
            'CalifPrevio': cp,  
            'Variacion': ca - cp,  
            'ReseñasTot': total,  
            'NuevasMes': nuevas,  
            'Pos%': pos_pct,  
            'Neg%': neg_pct  
        })  
    df_metrics = pd.DataFrame(metrics)  

    # Resumen horizontes  
    summary = []  
    for b, grp in df.groupby('Edificio'):  
        for m,label in [(None,'Hist'),(12,'12m'),(6,'6m'),(3,'3m')]:  
            cutoff = None if m is None else datetime.now()-relativedelta(months=m)  
            dh = grp if cutoff is None else grp[grp['Fecha']>=cutoff]  
            tot = len(dh)  
            summary.append({  
                'Edificio':b,'Horizonte':label,  
                'Calif': dh['Score'].mean() if tot else 0,  
                'TotRes': tot,  
                'Pos%': (dh['Sentimiento']=='Positiva').mean()*100 if tot else 0,  
                'Neg%': (dh['Sentimiento']=='Negativa').mean()*100 if tot else 0  
            })  
    df_resumen = pd.DataFrame(summary)  

    # Distribución de temas en positivas  
    df_pos_raw = df[df['Sentimiento']=='Positiva']  
    df_pos_dist = df_pos_raw['Temas'].explode().value_counts().reset_index()  
    df_pos_dist.columns = ['Tema','Conteo']  

    # Calcular % de género por Tema  
    df_temp = df_pos_raw[['Temas','Sexo']].explode('Temas')  
    df_temp['SexoSimple'] = df_temp['Sexo'].map(lambda x: 'male' if x in ['male','mostly_male'] else 'female' if x in ['female','mostly_female'] else None)  
    gender_counts = df_temp.dropna(subset=['SexoSimple']).groupby(['Temas','SexoSimple']).size().unstack(fill_value=0)  
    gender_pct = gender_counts.div(gender_counts.sum(axis=1), axis=0).mul(100).rename(columns={'male':'Male%','female':'Female%'}).reset_index()  
    df_pos_dist = df_pos_dist.merge(gender_pct, left_on='Tema', right_on='Temas', how='left').drop(columns=['Temas'])  

    # Distribución de temas en negativas  
    df_neg_raw = df[df['Sentimiento']=='Negativa']  
    df_neg_dist = df_neg_raw['Temas'].explode().value_counts().reset_index()  
    df_neg_dist.columns = ['Tema','Conteo']

    # Calcular % de género por Tema  
    df_temp = df_neg_raw[['Temas','Sexo']].explode('Temas')  
    df_temp['SexoSimple'] = df_temp['Sexo'].map(lambda x: 'male' if x in ['male','mostly_male'] else 'female' if x in ['female','mostly_female'] else None)  
    gender_counts = df_temp.dropna(subset=['SexoSimple']).groupby(['Temas','SexoSimple']).size().unstack(fill_value=0)  
    gender_pct = gender_counts.div(gender_counts.sum(axis=1), axis=0).mul(100).rename(columns={'male':'Male%','female':'Female%'}).reset_index()  
    df_neg_dist = df_neg_dist.merge(gender_pct, left_on='Tema', right_on='Temas', how='left').drop(columns=['Temas'])  

    # Distribución de amenities  
    df_am_dist = df['Amenidades'].explode().value_counts().reset_index()  
    df_am_dist.columns = ['Amenidad','Conteo']

    # Calcular % de género por Amenidad  
    df_temp = df[['Amenidades','Sexo']].explode('Amenidades')  
    df_temp['SexoSimple'] = df_temp['Sexo'].map(lambda x: 'male' if x in ['male','mostly_male'] else 'female' if x in ['female','mostly_female'] else None)  
    gender_counts_am = df_temp.dropna(subset=['SexoSimple']).groupby(['Amenidades','SexoSimple']).size().unstack(fill_value=0)  
    gender_pct_am = gender_counts_am.div(gender_counts_am.sum(axis=1), axis=0).mul(100).rename(columns={'male':'Male%','female':'Female%'}).reset_index().rename(columns={'Amenidades':'Amenidad'})  
    df_am_dist = df_am_dist.merge(gender_pct_am, on='Amenidad', how='left')  

    # Pivotes de temas y amenities  
    df_pos = df_pos_raw[['Edificio','Temas']].explode('Temas')  
    pivot_pos = pd.crosstab(df_pos['Edificio'], df_pos['Temas'])  
    df_neg = df_neg_raw[['Edificio','Temas']].explode('Temas')  
    pivot_neg = pd.crosstab(df_neg['Edificio'], df_neg['Temas'])  
    df_am = df[['Edificio','Amenidades']].explode('Amenidades')  
    pivot_am = pd.crosstab(df_am['Edificio'], df_am['Amenidades'])  

    # -------------------------------------------  
    # Evolución diaria promedio acumulado  
    # -------------------------------------------  
    start_date = datetime(2024,1,1).date()
    end_date   = datetime.now().date()
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')
    evolucion  = pd.DataFrame(index=date_range)
    for b in df['Edificio'].unique():
        df_b = df[df['Edificio']==b].dropna(subset=['Fecha']).copy()
        if df_b.empty:
            evolucion[b] = pd.NA
            continue
        df_b = df_b.sort_values('Fecha')
        promedio_acum = []
        for fecha in date_range:
            corte = df_b[df_b['Fecha'].dt.date <= fecha.date()]
            if corte.empty:
                promedio_acum.append(pd.NA)
            else:
                promedio_acum.append(corte['Score'].mean())
        evolucion[b] = promedio_acum

    # -------------------------------------------  
    # Evolución diaria conteo acumulado  
    # -------------------------------------------  
    evolucion_count = pd.DataFrame(index=date_range)
    for b in df['Edificio'].unique():
        df_b = df[df['Edificio']==b].dropna(subset=['Fecha']).copy()
        if df_b.empty:
            evolucion_count[b] = 0
            continue
        df_b = df_b.sort_values('Fecha')
        conteo_acum = []
        for fecha in date_range:
            conteo_acum.append(df_b[df_b['Fecha'].dt.date <= fecha.date()].shape[0])
        evolucion_count[b] = conteo_acum

    # Exportar a único Excel con todas las hojas

    try:  
        with pd.ExcelWriter(OUTPUT_XLSX, engine='openpyxl') as writer:  
            df.to_excel(writer, sheet_name='Comentarios_Raw', index=False)  
            df_pos_raw.to_excel(writer, sheet_name='Comentarios_Pos', index=False)  
            df_neg_raw.to_excel(writer, sheet_name='Comentarios_Neg', index=False)  
            df_metrics.to_excel(writer, sheet_name='Metrics', index=False)  
            df_resumen.to_excel(writer, sheet_name='Resumen', index=False)  
            df_pos_dist.to_excel(writer, sheet_name='Dist_Pos', index=False)  
            df_neg_dist.to_excel(writer, sheet_name='Dist_Neg', index=False)  
            df_am_dist.to_excel(writer, sheet_name='Amenities', index=False)  
            pivot_pos.reset_index().to_excel(writer, sheet_name='Pivot_Pos', index=False)  
            pivot_neg.reset_index().to_excel(writer, sheet_name='Pivot_Neg', index=False)  
            pivot_am.reset_index().to_excel(writer, sheet_name='Pivot_Amen', index=False)  
            evolucion.reset_index().rename(columns={'index':'Fecha'}).to_excel(writer, sheet_name='Evol_Promedio', index=False)  
            evolucion_count.reset_index().rename(columns={'index':'Fecha'}).to_excel(writer, sheet_name='Evol_Count', index=False)  
    except PermissionError:  
        print(f"Error: el archivo {OUTPUT_XLSX} está abierto. Por favor ciérralo e inténtalo de nuevo.")  
        return  

    print(f"Informe generado en: {OUTPUT_XLSX}")  
    print("Creando carpeta:", os.path.dirname(OUTPUT_XLSX))
    print("Exportando informe a:", os.path.abspath(OUTPUT_XLSX))

# -------------------------------------------  
# 8. Punto de entrada  
# -------------------------------------------  
print("Ejecutando análisis...")
main_analisis()
