"""Servico para geracao de PDFs do modulo CRM Saude (Prescricoes, Recibos, etc)."""
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from src.db.models_crm import Prescription, Payment, Patient, HealthProfessional, Unit, ExamRequest
from src.db.models import Organization

def _get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CenterTitle', parent=styles['Heading1'], alignment=1, spaceAfter=20))
    styles.add(ParagraphStyle(name='SubTitle', parent=styles['Heading2'], alignment=1, spaceAfter=20))
    styles.add(ParagraphStyle(name='InfoContext', parent=styles['Normal'], fontSize=10, textColor=colors.darkslategray))
    styles.add(ParagraphStyle(name='ItemTitle', parent=styles['Heading3'], spaceAfter=5))
    styles.add(ParagraphStyle(name='ItemDesc', parent=styles['Normal'], fontSize=11, leading=14, spaceAfter=15))
    return styles

def generate_prescription_pdf(
    prescription: Prescription,
    patient: Patient,
    professional: HealthProfessional,
    unit: Unit | None,
    organization: Organization
) -> bytes:
    """Gera um PDF de Receituario Medico em bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
    )
    
    styles = _get_styles()
    elements = []

    # Cabecalho da Clinica/Organizacao
    elements.append(Paragraph(organization.name.upper(), styles['CenterTitle']))
    if unit:
        elements.append(Paragraph(f"Unidade: {unit.name}", styles['SubTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.black, spaceAfter=20))

    # Info Profissional & Paciente
    info_data = [
        [
            Paragraph(f"<b>Profissional:</b> {professional.full_name}", styles['InfoContext']),
            Paragraph(f"<b>Registro:</b> {professional.council} {professional.registration_number} - {professional.council_uf}", styles['InfoContext'])
        ],
        [
            Paragraph(f"<b>Paciente:</b> {patient.full_name}", styles['InfoContext']),
            Paragraph(f"<b>Data:</b> {prescription.created_at.strftime('%d/%m/%Y')}", styles['InfoContext'])
        ]
    ]
    t = Table(info_data, colWidths=[3.5*inch, 3*inch])
    t.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("RECEITUÁRIO", styles['CenterTitle']))
    elements.append(Spacer(1, 10))

    # Itens da Prescricao (Medicamentos e Posologia)
    for pos, item in enumerate(prescription.items, start=1):
        elements.append(Paragraph(f"{pos}. {item.medication} - {item.dosage}", styles['ItemTitle']))
        
        desc_text = f"<b>Uso:</b> {item.posology}"
        if item.instructions:
            desc_text += f"<br/><b>Instruções:</b> {item.instructions}"
        elements.append(Paragraph(desc_text, styles['ItemDesc']))

    # Rodape / Assinatura
    elements.append(Spacer(1, 50))
    elements.append(HRFlowable(width="50%", thickness=1, color=colors.black, spaceAfter=10, hAlign='CENTER'))
    elements.append(Paragraph(f"Assinatura do Profissional<br/>{professional.full_name}", ParagraphStyle(name='Sig', parent=styles['Normal'], alignment=1)))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generate_payment_receipt_pdf(
    payment: Payment,
    patient: Patient,
    professional: HealthProfessional,
    organization: Organization
) -> bytes:
    """Gera um PDF de Recibo de Pagamento em bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
    )
    
    styles = _get_styles()
    elements = []

    # Cabecalho
    elements.append(Paragraph(organization.name.upper(), styles['CenterTitle']))
    elements.append(Paragraph("RECIBO DE PAGAMENTO", styles['SubTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.black, spaceAfter=20))

    amount_str = f"R$ {payment.amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    
    receipt_text = f"""
    Recebi(emos) de <b>{patient.full_name}</b>, portador(a) do CPF {patient.cpf or 'Não informado'}, 
    a importância de <b>{amount_str}</b> referente ao atendimento realizado pelo profissional 
    <b>{professional.full_name}</b> ({professional.council} {professional.registration_number}-{professional.council_uf}).
    """
    elements.append(Paragraph(receipt_text, styles['Normal']))
    elements.append(Spacer(1, 20))

    # Detalhes do Pagamento
    details_data = [
        ["Identificador:", payment.id],
        ["Data do Pagamento:", payment.paid_at.strftime('%d/%m/%Y %H:%M')],
        ["Método:", payment.payment_method.upper()],
        ["Valor:", amount_str],
    ]
    t = Table(details_data, colWidths=[2*inch, 4*inch])
    t.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    elements.append(t)
    
    if payment.notes:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"<b>Observações:</b> {payment.notes}", styles['Normal']))

    # Assinatura
    elements.append(Spacer(1, 50))
    elements.append(HRFlowable(width="50%", thickness=1, color=colors.black, spaceAfter=10, hAlign='CENTER'))
    elements.append(Paragraph(f"Emissão local<br/>{organization.name}", ParagraphStyle(name='Sig', parent=styles['Normal'], alignment=1)))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

def generate_exam_request_pdf(
    exam_request: ExamRequest,
    patient: Patient,
    professional: HealthProfessional,
    organization: Organization
) -> bytes:
    """Gera um PDF de Solicitacao de Exames em bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
    )
    
    styles = _get_styles()
    elements = []

    # Cabecalho
    elements.append(Paragraph(organization.name.upper(), styles['CenterTitle']))
    elements.append(Paragraph("SOLICITAÇÃO DE EXAMES", styles['SubTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.black, spaceAfter=20))

    # Info Profissional & Paciente
    info_data = [
        [
            Paragraph(f"<b>Profissional:</b> {professional.full_name}", styles['InfoContext']),
            Paragraph(f"<b>Registro:</b> {professional.council} {professional.registration_number} - {professional.council_uf}", styles['InfoContext'])
        ],
        [
            Paragraph(f"<b>Paciente:</b> {patient.full_name}", styles['InfoContext']),
            Paragraph(f"<b>Data:</b> {exam_request.created_at.strftime('%d/%m/%Y')}", styles['InfoContext'])
        ]
    ]
    t = Table(info_data, colWidths=[3.5*inch, 3*inch])
    t.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 20))

    # Itens do Exame
    for pos, item in enumerate(exam_request.items, start=1):
        elements.append(Paragraph(f"{pos}. {item.exam_name}", styles['ItemTitle']))
        
        if item.instructions:
            elements.append(Paragraph(f"<b>Instruções:</b> {item.instructions}", styles['ItemDesc']))
        else:
            elements.append(Spacer(1, 10))

    # Rodape / Assinatura
    elements.append(Spacer(1, 40))
    elements.append(HRFlowable(width="50%", thickness=1, color=colors.black, spaceAfter=10, hAlign='CENTER'))
    elements.append(Paragraph(f"Assinatura do Profissional<br/>{professional.full_name}", ParagraphStyle(name='Sig', parent=styles['Normal'], alignment=1)))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
