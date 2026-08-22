import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor() { }

  async generateShippingLabel(commande: any, clientInfo: any): Promise<void> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [100, 150] // Format étiquette 10cm x 15cm
    });

    // Couleurs
    const primaryColor = '#0ea5e9';
    const textColor = '#0f172a';
    const lightGray = '#f1f5f9';

    // Fond avec dégradé simulé
    pdf.setFillColor(240, 249, 255);
    pdf.rect(0, 0, 100, 150, 'F');

    // En-tête BFExpress
    pdf.setFillColor(14, 165, 233);
    pdf.rect(0, 0, 100, 25, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('BFExpress', 50, 12, { align: 'center' });
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Service de Livraison', 50, 18, { align: 'center' });

    // QR Code unique pour le colis
    const qrData = JSON.stringify({
      id: commande.id,
      codeBarre: commande.codeBarre,
      expeditionId: clientInfo.id
    });

    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        width: 100,
        margin: 1,
        color: {
          dark: '#0ea5e9',
          light: '#ffffff'
        }
      });

      pdf.addImage(qrCodeDataURL, 'PNG', 35, 30, 30, 30);
    } catch (error) {
      console.error('Erreur génération QR code:', error);
    }

    // Informations du colis
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Code colis:', 10, 70);
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(commande.codeBarre || commande.id?.substring(0, 8) || 'N/A', 10, 75);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Destinataire:', 10, 85);
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    
    // Utiliser le nomDestinataire si disponible
    const destName = commande.nomDestinataire || 'N/A';
    pdf.text(destName, 10, 90);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Téléphone:', 10, 100);
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    
    // Utiliser le téléphone de l'adresseArrivee si disponible
    const phone = commande.adresseArrivee?.telephone || commande.telephone || commande.phone1 || 'N/A';
    pdf.text(phone, 10, 105);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Adresse:', 10, 115);
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    
    // Utiliser l'adresse complète depuis adresseArrivee si disponible
    let address = '';
    if (commande.adresseArrivee) {
      const addr = commande.adresseArrivee;
      address = `${addr.rue || ''}, ${addr.localite || ''}, ${addr.ville || ''}, ${addr.gouvernorat || ''}`;
      if (addr.codePostal) {
        address += ` ${addr.codePostal}`;
      }
    } else {
      address = commande.adresse || `${commande.locality || ''}, ${commande.city || ''}, ${commande.governorate || ''}`;
    }
    
    pdf.text(this.wrapText(address, 80), 10, 120);

    // Informations client (expéditeur)
    pdf.setFillColor(241, 245, 249);
    pdf.rect(0, 130, 100, 20, 'F');
    
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Expéditeur:', 5, 136);
    
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text(clientInfo.name || 'N/A', 5, 140);
    pdf.text(clientInfo.phone || 'N/A', 5, 144);

    // COD montant
    if (commande.montantTotal && commande.montantTotal > 0) {
      pdf.setFillColor(239, 68, 68);
      pdf.rect(60, 130, 35, 15, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text('COD', 62, 136);
      
      pdf.setFontSize(10);
      pdf.text(`${commande.montantTotal} DT`, 62, 142);
    }

    // Type de service
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Service: ${commande.typeService || 'STANDARD'}`, 5, 148);

    // Footer avec date
    pdf.setFillColor(14, 165, 233);
    pdf.rect(0, 145, 100, 5, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(6);
    pdf.text(new Date().toLocaleDateString('fr-FR'), 50, 148.5, { align: 'center' });

    // Sauvegarder le PDF
    const fileName = `etiquette_${commande.codeBarre || commande.id?.substring(0, 8)}.pdf`;
    pdf.save(fileName);
  }

  async generateBulkShippingLabels(commandes: any[], clientInfo: any): Promise<void> {
    for (const commande of commandes) {
      await this.generateShippingLabel(commande, clientInfo);
      // Petit délai pour éviter les problèmes de navigateur
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async generateManifestPDF(manifestData: any, commandes: any[], clientInfo: any): Promise<void> {
    console.log('📄 Generation PDF Manifeste:', manifestData);
    console.log('📄 Commandes pour PDF:', commandes);
    console.log('📄 Client info:', clientInfo);
    
    // Debug: Vérifier la structure de la première commande
    if (commandes.length > 0) {
      console.log('📄 Première commande structure:', JSON.stringify(commandes[0], null, 2));
    }
    
    const pdf = new jsPDF();
    
    // En-tête entreprise
    pdf.setFillColor(14, 165, 233);
    pdf.rect(0, 0, 210, 35, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('BFExpress', 105, 15, { align: 'center' });
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Service de Livraison Professionnel', 105, 22, { align: 'center' });
    pdf.text('Manifeste de Collecte', 105, 28, { align: 'center' });

    // Informations du manifeste
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    
    let yPos = 45;
    pdf.text(`N° Manifeste: ${manifestData.id?.substring(0, 8) || 'N/A'}`, 15, yPos);
    pdf.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 120, yPos);
    pdf.text(`Expéditeur: ${clientInfo.name || 'N/A'}`, 15, yPos + 8);
    pdf.text(`Téléphone: ${clientInfo.phone || 'N/A'}`, 120, yPos + 8);
    pdf.text(`Nombre de colis: ${commandes.length}`, 15, yPos + 16);
    
    const totalCOD = commandes.reduce((sum, cmd) => sum + (cmd.montantTotal || 0), 0);
    pdf.text(`Total COD: ${totalCOD} DT`, 120, yPos + 16);

    // Tableau des colis
    yPos += 25;
    
    // En-tête du tableau
    pdf.setFillColor(241, 245, 249);
    pdf.rect(10, yPos, 190, 10, 'F');
    
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    
    pdf.text('N°', 12, yPos + 7);
    pdf.text('Code Barre', 25, yPos + 7);
    pdf.text('Destinataire', 65, yPos + 7);
    pdf.text('Téléphone', 105, yPos + 7);
    pdf.text('Gouvernorat', 140, yPos + 7);
    pdf.text('Ville', 165, yPos + 7);
    pdf.text('COD (DT)', 185, yPos + 7);

    yPos += 15;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    
    commandes.forEach((cmd, index) => {
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
        
        // Répéter l'en-tête du tableau sur la nouvelle page
        pdf.setFillColor(241, 245, 249);
        pdf.rect(10, yPos, 190, 10, 'F');
        
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        
        pdf.text('N°', 12, yPos + 7);
        pdf.text('Code Barre', 25, yPos + 7);
        pdf.text('Destinataire', 65, yPos + 7);
        pdf.text('Téléphone', 105, yPos + 7);
        pdf.text('Gouvernorat', 140, yPos + 7);
        pdf.text('Ville', 165, yPos + 7);
        pdf.text('COD (DT)', 185, yPos + 7);

        yPos += 15;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
      }
      
      // Numéro de ligne
      pdf.text(`${index + 1}`, 12, yPos);
      
      // Code barre
      pdf.text(cmd.codeBarre || cmd.id?.substring(0, 8) || 'N/A', 25, yPos);
      
      // Destinataire
      const destName = cmd.nomDestinataire || cmd.destinataire?.nom || 'N/A';
      pdf.text(destName, 65, yPos);
      
      // Téléphone
      const phone = cmd.adresseArrivee?.telephone || cmd.telephone || cmd.phone1 || cmd.destinataire?.telephone || 'N/A';
      pdf.text(phone, 105, yPos);
      
      // Gouvernorat
      const gov = cmd.adresseArrivee?.gouvernorat || cmd.governorate || cmd.adresseArrivee?.region || cmd.destinataire?.gouvernorat || 'N/A';
      pdf.text(gov, 140, yPos);
      
      // Ville
      const city = cmd.adresseArrivee?.ville || cmd.city || cmd.adresseArrivee?.localite || cmd.destinataire?.ville || 'N/A';
      pdf.text(city, 165, yPos);
      
      // COD
      pdf.text(`${cmd.montantTotal || 0}`, 185, yPos);
      
      yPos += 8;
    });

    // Pied de page
    const footerY = pdf.internal.pageSize.height - 20;
    pdf.setFillColor(14, 165, 233);
    pdf.rect(0, footerY, 210, 20, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('BFExpress - Service de Livraison Professionnel', 105, footerY + 5, { align: 'center' });
    pdf.text(`${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`, 105, footerY + 12, { align: 'center' });
    pdf.text('Document généré automatiquement', 105, footerY + 19, { align: 'center' });

    const fileName = `manifeste_${manifestData.id?.substring(0, 8) || 'draft'}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (testLine.length > maxWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }
}