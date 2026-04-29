export default async function handler(req, res) {
    const { phone, pin } = req.query;

    const USERS_FILE_ID = '1XgS_6oukQvuoG1gL7w5OxTrNlxXbg11w';
    const CONFIG_FILE_ID = '1hcS_8-8qDv5w_-4wPG0RGk0IZH8mlijw';
    const SERVICES_FILE_ID = '10qCz9BvefhEvzXQsqarkFTgIG7YWy82m';

    const getGDriveUrl = (id) => `https://docs.google.com/uc?export=download&id=${id}`;

    // Тоог цэвэрлэж унших туслах функц (₮ болон таслалыг арилгана)
    const cleanNum = (val) => {
        if (!val) return 0;
        const cleaned = val.toString().replace(/[^0-9.-]/g, '');
        return parseFloat(cleaned) || 0;
    };

    try {
        const usersRes = await fetch(getGDriveUrl(USERS_FILE_ID));
        const usersText = await usersRes.text();
        const isValidUser = usersText.split('\n').some(line => {
            const [uPhone, uPin] = line.trim().split('|');
            return uPhone === phone && uPin === pin;
        });

        if (!isValidUser) return res.status(401).json({ success: false, message: "Нууц код буруу!" });

        const [configRes, servicesRes] = await Promise.all([
            fetch(getGDriveUrl(CONFIG_FILE_ID)),
            fetch(getGDriveUrl(SERVICES_FILE_ID))
        ]);

        const configLines = (await configRes.text()).split('\n').filter(l => l.trim());
        const servicesLines = (await servicesRes.text()).split('\n').filter(l => l.trim());

        const myLoans = configLines.filter(line => {
            const parts = line.split('|').map(p => p.trim());
            return parts[3] === phone && parts[21] !== "Хаагдсан" && parts[17] === "" && parts[19] === "";
        });

        if (myLoans.length === 0) return res.status(404).json({ success: false, message: "Идэвхтэй зээл олдсонгүй." });

        const resultLoans = myLoans.map(loanLine => {
            const parts = loanLine.split('|').map(p => p.trim());
            const nd = parts[0];
            const no = parts[1];
            const name = parts[2];
            const originalAmount = cleanNum(parts[4]);
            const putDate = parts[8];
            const configExtDate = parts[16];

            let totalDiscount = 0;
            let latestPaymentDate = (configExtDate && configExtDate !== "") ? configExtDate : putDate;

            // СУНГАЛТ болон ХАСАЛТЫГ тооцох
            servicesLines.forEach(sLine => {
                const sParts = sLine.split('|').map(p => p.trim());
                if (sParts[0] === nd && sParts[1] === no && sParts[2] === name) {
                    // Сунгалтын файл дахь Index 9-ийг цэвэрлэж авна
                    totalDiscount += cleanNum(sParts[9]);
                    
                    // Хамгийн сүүлийн огноог шинэчлэх
                    if (sParts[3] > latestPaymentDate) {
                        latestPaymentDate = sParts[3];
                    }
                }
            });

            const remainingAmount = originalAmount - totalDiscount;
            
            // Огноо бодох
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const start = new Date(latestPaymentDate);
            start.setHours(0, 0, 0, 0);
            
            const diffTime = today - start;
            const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

            // Хүү бодох (0.14%)
            const interest = Math.round(remainingAmount * 0.0014 * diffDays);
            
            // Торгууль (30 хоногоос хэтэрвэл)
            let penalty = 0;
            if (diffDays > 30) {
                const extraDays = diffDays - 30;
                penalty = Math.round((remainingAmount * 0.0014) * extraDays * 0.2);
            }

            const redHvv = cleanNum(parts[18]);
            const totalInterest = (redHvv > 0) ? redHvv : (interest + penalty);

            return {
                nd, no, name, 
                amount: remainingAmount, 
                date: putDate, 
                lastPayment: latestPaymentDate,
                days: diffDays, 
                totalInterest: totalInterest
            };
        });

        return res.status(200).json({ success: true, loans: resultLoans });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Алдаа: " + error.message });
    }
}
