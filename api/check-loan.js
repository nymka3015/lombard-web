export default async function handler(req, res) {
    const { phone, pin } = req.query;

    const USERS_FILE_ID = '1XgS_6oukQvuoG1gL7w5OxTrNlxXbg11w';
    const CONFIG_FILE_ID = '1hcS_8-8qDv5w_-4wPG0RGk0IZH8mlijw';
    const SERVICES_FILE_ID = '10qCz9BvefhEvzXQsqarkFTgIG7YWy82m';

    const getGDriveUrl = (id) => `https://docs.google.com/uc?export=download&id=${id}`;

    const cleanNum = (val) => {
        if (!val) return 0;
        const cleaned = val.toString().replace(/[^0-9]/g, '');
        return parseFloat(cleaned) || 0;
    };

    try {
        const usersRes = await fetch(getGDriveUrl(USERS_FILE_ID));
        const usersText = await usersRes.text();
        const isValidUser = usersText.split('\n').some(line => {
            const parts = line.trim().split('|');
            return parts[0] === phone && parts[1] === pin;
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

        // ... (өмнөх cleanNum болон бусад хэсэг хэвээрээ)

        const resultLoans = myLoans.map(loanLine => {
            const parts = loanLine.split('|').map(p => p.trim());
            const nd = parts[0].toUpperCase();
            const no = parts[1].toUpperCase();
            const originalAmount = cleanNum(parts[4]);
            const putDate = parts[8];
            const configExtDate = parts[16];

            let totalDiscount = 0;
            let latestPaymentDate = (configExtDate && configExtDate !== "") ? configExtDate : putDate;

            servicesLines.forEach(sLine => {
                const sParts = sLine.split('|').map(p => p.trim());
                if (sParts.length >= 10) {
                    if (sParts[0].toUpperCase() === nd && sParts[1].toUpperCase() === no) {
                        totalDiscount += cleanNum(sParts[9]);
                        if (sParts[3] > latestPaymentDate) latestPaymentDate = sParts[3];
                    }
                }
            });

            const remainingAmount = originalAmount - totalDiscount;
            const today = new Date(); today.setHours(0,0,0,0);
            const start = new Date(latestPaymentDate); start.setHours(0,0,0,0);
            
            const diffTime = today - start;
            const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

            // ХОНОГИЙГ САЛГАХ ЛОГИК
            const normalDays = Math.min(30, diffDays);
            const overdueDays = Math.max(0, diffDays - 30);

            const interest = Math.round(remainingAmount * 0.0014 * diffDays);
            let penalty = 0;
            if (diffDays > 30) {
                penalty = Math.round((remainingAmount * 0.0014) * overdueDays * 0.2);
            }

            const redHvv = cleanNum(parts[18]);
            const finalInterest = (redHvv > 0) ? redHvv : (interest + penalty);

            return {
                nd, no, name: parts[2],
                amount: remainingAmount,
                date: putDate,
                lastPayment: latestPaymentDate,
                days: diffDays,
                normalDays: normalDays,      // 30 хүртэлх хоног
                overdueDays: overdueDays,    // Хэтэрсэн хоног
                totalInterest: finalInterest
            };
        });
// ...

        return res.status(200).json({ success: true, loans: resultLoans });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Алдаа: " + error.message });
    }
}
