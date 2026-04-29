export default async function handler(req, res) {
    const { phone, pin } = req.query;

    // --- ӨӨРИЙН ID-НУУДАА ЭНД СОЛЬЖ ТАВИАРАЙ ---
    const USERS_FILE_ID = '1XgS_6oukQvuoG1gL7w5OxTrNlxXbg11w';
    const CONFIG_FILE_ID = '1hcS_8-8qDv5w_-4wPG0RGk0IZH8mlijw';
    const SERVICES_FILE_ID = '10qCz9BvefhEvzXQsqarkFTgIG7YWy82m';

    const getGDriveUrl = (id) => `https://docs.google.com/uc?export=download&id=${id}`;

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

        // Тухайн утасны дугаартай БҮХ идэвхтэй зээлийг шүүх
        const myLoans = configLines.filter(line => {
        const parts = line.split('|').map(p => p.trim()); // Бүх зайг арилгах
        
        const phoneMatch = parts[3] === phone;
        const status = parts[21] || "";
        const closeDate = parts[17] || ""; // Авсан огноо
        const sellDate = parts[19] || "";  // Зарсан огноо
    
        // ИДЭВХТЭЙ БАЙХ НӨХЦӨЛ:
        // 1. Утас таарах
        // 2. Төлөв нь "Хаагдсан" биш байх
        // 3. Авсан огноо (Index 17) хоосон байх
        // 4. Зарсан огноо (Index 19) хоосон байх
        const isActive = status !== "Хаагдсан" && closeDate === "" && sellDate === "";
    
        return phoneMatch && isActive;
        });

        if (myLoans.length === 0) return res.status(404).json({ success: false, message: "Идэвхтэй зээл олдсонгүй." });

        const resultLoans = myLoans.map(loanLine => {
            const parts = loanLine.split('|');
            const nd = parts[0];
            const no = parts[1];
            const name = parts[2];
            const originalAmount = parseFloat(parts[4].replace(/,/g, '')) || 0;
            const putDate = parts[8];

            // 1. Сунгалтын хамгийн сүүлийн огноо болон нийт хасалтыг олох
            let latestExtDate = putDate;
            let totalDiscount = 0;

            servicesLines.forEach(sLine => {
                const sParts = sLine.split('|');
                // ND, No, Name гурвуулаа таарч байвал
                if (sParts[0] === nd && sParts[1] === no && sParts[2] === name) {
                    totalDiscount += parseFloat(sParts[9].replace(/,/g, '')) || 0;
                    if (sParts[3] > latestExtDate) latestExtDate = sParts[3];
                }
            });

            const remainingAmount = originalAmount - totalDiscount;
            const today = new Date();
            const start = new Date(latestExtDate);
            
            // Хоног тооцох
            const diffTime = today - start;
            const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

            // Хүү (0.14%)
            const interest = Math.round(remainingAmount * 0.0014 * diffDays);
            
            // Торгууль (30 хоногоос хэтэрвэл 20%)
            let penalty = 0;
            if (diffDays > 30) {
                const extraDays = diffDays - 30;
                penalty = Math.round((remainingAmount * 0.0014) * extraDays * 0.2);
            }
            return {
                nd: parts[0], // Төрөл нэмэв (N эсвэл D)
                no, name, amount: remainingAmount, date: putDate, lastPayment: latestExtDate,
                days: diffDays, interest, penalty, totalInterest: interest + penalty
            };
        });

        return res.status(200).json({ success: true, loans: resultLoans });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Алдаа: " + error.message });
    }
}
