// Intentamos obtener la clave del localStorage (método seguro y dinámico para cliente)
// y si no existe, recurrimos a la variable de entorno de compilación.
const getOpenRouterKey = (): string => {
  if (typeof window !== 'undefined') {
    const savedKey = localStorage.getItem('openrouter_api_key');
    if (savedKey) return savedKey;
  }
  return import.meta.env.VITE_OPENROUTER_KEY || '';
};

export const analyzeMarket = async (prompt: string) => {
  const apiKey = getOpenRouterKey();

  if (!apiKey || apiKey.includes('TU_CLAVE_DE_OPENROUTER_AQUI')) {
    console.warn('OpenRouter API Key not found. Using mock response.');
    return "Simulación: La IA sugiere que Madrid tiene un gran potencial en este sector, especialmente en zonas con baja densidad competitiva.";
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "google/gemma-4-26b-a4b-it",
        "messages": [
          {"role": "user", "content": prompt}
        ],
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error calling OpenRouter:", error);
    return "Error al conectar con la IA. Por favor, revisa la configuración.";
  }
};
