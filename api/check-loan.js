export default async function handler(req, res) {
    const { phone, pin } = req.query;

    const USERS_FILE_ID = '1XgS_6oukQvuoG1gL7w5OxTrNlxXbg11w';
    const CONFIG_FILE_ID = '1hcS_8-8qDv5w_-4wPG0RGk0IZH8mlijw';
    const SERVICES_FILE_ID = '10qCz9BvefhEvzXQsqarkFTgIG7YWy82m';

    const getGDriveUrl = (id) => `https://docs.google.com/uc?export=download&id=${id}`;

    // Тоог цэвэрлэж унших функц (₮, таслал, сул зайг арилгана)
    const cleanNum = (val) => {
        if (!val) return 0;
        // Зөвхөн тоо, хасах тэмдэг, цэгийг үлдээнэ
        const cleaned = val.toString().replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    };

    try {
        // 1. Хэрэглэгч шалгах
        const usersRes = await fetch(getGDriveUrl(USERS_FILE_ID));
        const usersText = await usersRes.text();
        const isValidUser = usersText.split('\n').some(line => {
            const [uPhone, uPin] = line.trim().split('|');
            return uPhone === phone && uPin === pin;
        });

        if (!isValidUser) return res.status(401).json({ success: false, message: "Нууц код буруу!" });

        // 2. Файлуудыг зэрэг татаж авах
        const [configRes, servicesRes] = await Promise.all([
            fetch(getGDriveUrl(CONFIG_FILE_ID)),
            fetch(getGDriveUrl(SERVICES_FILE_ID))
        ]);

        const configLines = (await configRes.text()).split('\n').filter(l => l.trim());
        const servicesLines = (await servicesRes.text()).split('\n').filter(l => l.trim());

        // 3. Идэвхтэй зээлүүдийг шүүх
        const myLoans = configLines.filter(line => {
            const parts = line.split('|').map(p => p.trim());
            const phoneMatch = parts[3] === phone;
            const isNotClosed = parts[21] !== "Хаагдсан" && parts[17] === "" && parts[19] === "";
            return phoneMatch && isNotClosed;
        });

        if (myLoans.length === 0) return res.status(404).json({ success: false, message: "Идэвхтэй зээл олдсонгүй." });

        const resultLoans = myLoans.map(loanLine => {
            const parts = loanLine.split('|').map(p => p.trim());
            const nd = parts[0].toUpperCase();
            const no = parts[1].toUpperCase();
            const name = parts[2].toLowerCase();
            const originalAmount = cleanNum(parts[4]);
            const putDate = parts[8];
            const configExtDate = parts[16]; // system_config дээрх сунгалтын огноо

            let totalDiscount = 0;
            let latestPaymentDate = (configExtDate && configExtDate !== "") ? configExtDate : putDate;

            // 4. Сунгалтын файл доторх БҮХ хасалт болон хамгийн сүүлийн огноог олох
            servicesLines.forEach(sLine => {
                const sParts = sLine.split('|').map(p => p.trim());
                if (sParts.length >= 10) {
                    const sND = sParts[0].toUpperCase();
                    const sNo = sParts[1].toUpperCase();
                    const sName = sParts[2].toLowerCase();
                    const sDate = sParts[3];
                    const sDiscount = cleanNum(sParts[9]); // Index 9: Хасалт

                    // Төрөл, Дугаар, Нэр гурвуулаа таарч байвал хасалтыг нэмнэ
                    if (sND === nd && sNo === no && sName === name) {
                        totalDiscount += sDiscount;
                        // Хамгийн сүүлийн сунгалтын огноог шинэчлэх
                        if (sDate > latestPaymentDate) {
                            latestPaymentDate = sDate;
                        }
                    }
                }
            });

            // 5. Үлдэгдэл мөнгө бодох
            const remainingAmount = originalAmount - totalDiscount;

            // 6. Хоног болон Хүү тооцох
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const start = new Date(latestPaymentDate);
            start.setHours(0, 0, 0, 0);
            
            const diffTime = today - start;
            const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

            const interest = Math.round(remainingAmount * 0.0014 * diffDays);
            let penalty = 0;
            if (diffDays > 30) {
                const extraDays = diffDays - 30;
                penalty = Math.round((remainingAmount * 0.0014) * extraDays * 0.2);
            }

            const redHvv = cleanNum(parts[18]);
            const totalInterest = (redHvv > 0) ? redHvv : (interest + penalty);

            return {
                nd: parts[0],
                no: parts[1],
                name: parts[2],
                amount: remainingAmount, // Хасагдсан үлдэгдэл
                date: putDate,
                lastPayment: latestPaymentDate,
                days: diffDays,
                totalInterest: totalInterest
            };
        });

        return res.status(200).json({ success: true, loans: resultLoans });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, message: "Алдаа: " + error.message });
    }
}
