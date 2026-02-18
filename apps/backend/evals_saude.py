"""
Avaliações (Evals) do Agente de Saúde.

Baseado em https://docs.agno.com/evals/overview
- Accuracy: correção da resposta em relação a uma saída esperada (LLM-as-judge).
- Agent as Judge: critérios de qualidade customizados (clareza, fundamentação, etc.).
"""
from typing import Optional

from agno.agent import Agent
from agno.eval.accuracy import AccuracyEval, AccuracyResult
from agno.eval.agent_as_judge import AgentAsJudgeEval, AgentAsJudgeResult
from agno.models.google import Gemini
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.tavily import TavilyTools
from agno.tools.valyu import ValyuTools
from dotenv import load_dotenv

load_dotenv()

# Modelo do juiz (avaliador) – usar Gemini para não depender de OpenAI
EVAL_MODEL = Gemini(id="gemini-2.0-flash")


def get_agent() -> Agent:
    """Retorna o mesmo agente do agent_os (sem db para evals serem mais rápidos)."""
    return Agent(
        name="Assistente de Saúde",
        role="Responda perguntas baseadas em contextos buscados na internet e em artigos científicos.",
        instructions=[
            "Busque fontes confiáveis sobre o tema da pergunta.",
            "Use as ferramentas disponíveis para buscar informações.",
            "Se a pergunta não for sobre saúde, diga que não tem conhecimento sobre o assunto.",
            "Responda perguntas medicas com precisão e confiabilidade.",
        ],
        model=Gemini(id="gemini-2.0-flash"),
        tools=[DuckDuckGoTools(), ValyuTools(), TavilyTools()],
    )


# Casos de teste para Accuracy: pergunta + saída esperada (o juiz compara a resposta do agente)
ACCURACY_TEST_CASES = [
    {
        "input": "Quais são os benefícios da vitamina D para a saúde?",
        "expected_output": "A vitamina D é importante para a saúde dos ossos, absorção de cálcio, função imunológica e pode ajudar na prevenção de algumas doenças. A deficiência pode causar raquitismo e osteomalácia.",
    },
    {
        "input": "O que é pressão arterial alta e por que é perigosa?",
        "expected_output": "Pressão arterial alta (hipertensão) é quando a força do sangue nas artérias está elevada. Pode levar a risco de infarto, AVC, insuficiência renal e outros problemas se não controlada.",
    },
    {
        "input": "Quais alimentos são ricos em fibras?",
        "expected_output": "Alimentos ricos em fibras incluem frutas (maçã, pera), verduras, legumes, grãos integrais, aveia, feijão, lentilha e nozes.",
    },
]

# Critério para Agent as Judge (qualidade da resposta de saúde)
AGENT_AS_JUDGE_CRITERIA = (
    "A resposta deve ser relevante para saúde, clara e acessível. "
    "Deve mencionar ou sugerir fundamentação (fontes, evidências ou recomendações gerais). "
    "Não deve dar diagnóstico ou tratamento específico para uma pessoa; deve orientar de forma geral. "
    "Se a pergunta não for sobre saúde, a resposta deve recusar educadamente."
)


def run_accuracy_evals(
    agent: Optional[Agent] = None,
    test_cases: Optional[list] = None,
    print_results: bool = True,
) -> list[Optional[AccuracyResult]]:
    """
    Executa avaliações de Accuracy para cada caso de teste.
    docs.agno.com/evals/accuracy/overview
    """
    agent = agent or get_agent()
    test_cases = test_cases or ACCURACY_TEST_CASES
    results = []

    for i, case in enumerate(test_cases):
        eval_acc = AccuracyEval(
            model=EVAL_MODEL,
            agent=agent,
            input=case["input"],
            expected_output=case["expected_output"],
            additional_guidelines="Considere a resposta correta se o conteúdo principal e os pontos-chave estiverem presentes, mesmo com redação diferente.",
            name=f"Accuracy Saúde #{i+1}",
        )
        result = eval_acc.run(print_results=print_results)
        results.append(result)

    return results


def run_agent_as_judge(
    agent: Optional[Agent] = None,
    test_inputs: Optional[list[str]] = None,
    print_results: bool = True,
) -> Optional[AgentAsJudgeResult]:
    """
    Executa Agent as Judge: roda o agente com cada pergunta e avalia a qualidade
    da resposta segundo critérios customizados.
    docs.agno.com/evals/agent-as-judge/overview
    """
    agent = agent or get_agent()
    test_inputs = test_inputs or [tc["input"] for tc in ACCURACY_TEST_CASES]

    # Rodar o agente para cada entrada e montar casos {input, output}
    cases = []
    for prompt in test_inputs:
        response = agent.run(prompt, stream=False)
        output = response.content if response and response.content else ""
        if not isinstance(output, str):
            output = str(output)
        cases.append({"input": prompt, "output": output})

    eval_judge = AgentAsJudgeEval(
        model=EVAL_MODEL,
        criteria=AGENT_AS_JUDGE_CRITERIA,
        scoring_strategy="numeric",
        threshold=7,
        additional_guidelines=[
            "Dê nota 1-10. Respostas que citam fontes ou recomendações gerais tendem a ser melhores.",
            "Desconhecimento educado sobre temas fora de saúde deve ser considerado adequado.",
        ],
        name="Agent as Judge - Assistente Saúde",
    )

    return eval_judge.run(cases=cases, print_results=print_results, print_summary=True)


def main():
    """Roda todas as avaliações: Accuracy e Agent as Judge."""
    agent = get_agent()

    print("\n" + "=" * 60)
    print("  AVALIAÇÕES DE ACCURACY (correção da resposta)")
    print("  docs.agno.com/evals/overview")
    print("=" * 60)
    run_accuracy_evals(agent=agent, print_results=True)

    print("\n" + "=" * 60)
    print("  AGENT AS JUDGE (qualidade: clareza, fundamentação)")
    print("=" * 60)
    run_agent_as_judge(agent=agent, print_results=True)


if __name__ == "__main__":
    main()
